/**
 * TaxLogic.local - RAG Retriever
 *
 * Retrieval-Augmented Generation for Austrian tax questions:
 * - Combines knowledge base search with LLM generation
 * - Provides contextual tax advice
 * - Cites sources for answers
 */

import { llmService, Message } from '../services/llmService';
import { knowledgeBase, SearchResult, KnowledgeCategory } from './knowledgeBase';
import { embeddingsService } from './embeddings';

// ========================================
// Type Definitions
// ========================================

export interface RAGQuery {
  question: string;
  category?: KnowledgeCategory;
  maxContextTokens?: number;
  includeSourceCitations?: boolean;
  conversationHistory?: Message[];
}

export interface RAGResponse {
  answer: string;
  sources: SourceCitation[];
  confidence: number;
  context: string;
  processingTime: number;
}

export interface SourceCitation {
  title: string;
  source: string;
  excerpt: string;
  relevance: number;
}

export interface RetrievalStats {
  queryCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

// ========================================
// Retriever Service Class
// ========================================

export class RetrieverService {
  private queryCount: number = 0;
  private totalResponseTime: number = 0;

  /**
   * Answer a question using RAG
   */
  async query(input: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();
    this.queryCount++;

    const {
      question,
      category,
      maxContextTokens = 2000,
      includeSourceCitations = true,
      conversationHistory = []
    } = input;

    console.log(`[Retriever] Processing question: ${question.substring(0, 50)}...`);

    // Step 1: Retrieve relevant context from knowledge base
    const searchResults = await knowledgeBase.search(question, 5, category);

    // Step 2: Build context from search results
    const context = this.buildContext(searchResults, maxContextTokens);

    // Step 3: Extract source citations
    const sources: SourceCitation[] = searchResults.map((result) => ({
      title: result.chunk.metadata.title,
      source: result.document.source,
      excerpt: result.chunk.content.substring(0, 150) + '...',
      relevance: Math.round(result.similarity * 100) / 100
    }));

    // Step 4: Generate answer using LLM with context
    const systemPrompt = this.buildSystemPrompt(includeSourceCitations);
    const userPrompt = this.buildUserPrompt(question, context);

    const llmResponse = await llmService.query(userPrompt, conversationHistory, systemPrompt);

    // Step 5: Calculate confidence based on search relevance
    const confidence = this.calculateConfidence(searchResults);

    const processingTime = Date.now() - startTime;
    this.totalResponseTime += processingTime;

    console.log(`[Retriever] Response generated in ${processingTime}ms`);

    return {
      answer: llmResponse.content,
      sources: includeSourceCitations ? sources : [],
      confidence,
      context,
      processingTime
    };
  }

  /**
   * Quick answer without full RAG (for simple questions)
   */
  async quickAnswer(question: string): Promise<string> {
    // Try to find a high-confidence match
    const searchResults = await knowledgeBase.search(question, 1);

    if (searchResults.length > 0 && searchResults[0].similarity > 0.85) {
      // High confidence match - return knowledge base excerpt
      return searchResults[0].chunk.content;
    }

    // Fall back to LLM
    const response = await llmService.query(
      question,
      [],
      'Du bist ein österreichischer Steuerberater-Assistent. Antworte kurz und präzise auf Deutsch.'
    );

    return response.content;
  }

  /**
   * Get tax law context for a specific topic
   */
  async getTopicContext(topic: string, category?: KnowledgeCategory): Promise<{
    context: string;
    relevantDocuments: { title: string; excerpt: string }[];
  }> {
    const results = await knowledgeBase.search(topic, 3, category);

    const context = results.map((r) => r.chunk.content).join('\n\n');
    const relevantDocuments = results.map((r) => ({
      title: r.chunk.metadata.title,
      excerpt: r.chunk.content.substring(0, 200)
    }));

    return { context, relevantDocuments };
  }

  /**
   * Suggest follow-up questions based on a query
   */
  async suggestFollowUps(query: string): Promise<string[]> {
    const systemPrompt = `Du bist ein österreichischer Steuerberater-Assistent.
Basierend auf einer Steuerfrage, schlage 3 relevante Folgefragen vor.
Antworte nur mit den Fragen, eine pro Zeile, ohne Nummerierung.`;

    const response = await llmService.query(
      `Ursprüngliche Frage: "${query}"\n\nWelche Folgefragen könnten relevant sein?`,
      [],
      systemPrompt
    );

    return response.content
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && q.endsWith('?'))
      .slice(0, 3);
  }

  /**
   * Validate a tax-related claim
   */
  async validateClaim(claim: string): Promise<{
    isValid: boolean;
    explanation: string;
    sources: string[];
  }> {
    const results = await knowledgeBase.search(claim, 3);
    const context = results.map((r) => r.chunk.content).join('\n\n');

    const systemPrompt = `Du bist ein Experte für österreichisches Steuerrecht.
Prüfe, ob eine Behauptung korrekt ist, basierend auf dem gegebenen Kontext.
Antworte im Format:
GÜLTIG: ja/nein/teilweise
ERKLÄRUNG: [deine Erklärung]`;

    const response = await llmService.query(
      `Behauptung: "${claim}"\n\nKontext:\n${context}\n\nIst diese Behauptung korrekt?`,
      [],
      systemPrompt
    );

    const content = response.content;
    const isValidMatch = content.match(/GÜLTIG:\s*(ja|nein|teilweise)/i);
    const isValid =
      isValidMatch ? isValidMatch[1].toLowerCase() === 'ja' : false;

    return {
      isValid,
      explanation: content.replace(/GÜLTIG:.*\n?/i, '').replace(/ERKLÄRUNG:\s*/i, '').trim(),
      sources: results.map((r) => r.document.source)
    };
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: SearchResult[], maxTokens: number): string {
    let context = '';
    let currentTokens = 0;

    for (const result of results) {
      const chunkText = `[${result.chunk.metadata.title}]\n${result.chunk.content}\n\n`;
      const chunkTokens = Math.ceil(chunkText.length / 4);

      if (currentTokens + chunkTokens > maxTokens) break;

      context += chunkText;
      currentTokens += chunkTokens;
    }

    return context.trim();
  }

  /**
   * Build system prompt for RAG
   */
  private buildSystemPrompt(includeCitations: boolean): string {
    let prompt = `Du bist ein Experte für österreichisches Steuerrecht und hilfst bei der Arbeitnehmerveranlagung.

Deine Aufgaben:
1. Beantworte Steuerfragen präzise und verständlich
2. Beziehe dich auf den bereitgestellten Kontext
3. Gib praktische Tipps für die Steuererklärung
4. Weise auf wichtige Fristen und Grenzen hin

Wichtige Regeln:
- Antworte immer auf Deutsch
- Verwende €-Zeichen für Beträge
- Nenne konkrete Zahlen wenn bekannt
- Bei Unsicherheit sage es ehrlich`;

    if (includeCitations) {
      prompt += `
- Verweise auf Quellen wo möglich (z.B. "Laut §16 EStG...")`;
    }

    return prompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(question: string, context: string): string {
    if (context.length === 0) {
      return question;
    }

    return `Basierend auf folgendem Wissen über österreichisches Steuerrecht:

---
${context}
---

Beantworte folgende Frage:
${question}`;
  }

  /**
   * Calculate confidence based on search results
   */
  private calculateConfidence(results: SearchResult[]): number {
    if (results.length === 0) return 0;

    // Average similarity of top results, weighted by position
    let weightedSum = 0;
    let totalWeight = 0;

    results.forEach((result, index) => {
      const weight = 1 / (index + 1); // Decreasing weight for lower positions
      weightedSum += result.similarity * weight;
      totalWeight += weight;
    });

    const avgSimilarity = weightedSum / totalWeight;

    // Scale to 0-100 confidence score
    // Similarity > 0.7 = high confidence
    // Similarity > 0.5 = medium confidence
    // Similarity < 0.5 = low confidence
    if (avgSimilarity > 0.7) {
      return Math.min(95, 70 + avgSimilarity * 30);
    } else if (avgSimilarity > 0.5) {
      return 50 + avgSimilarity * 40;
    } else {
      return avgSimilarity * 100;
    }
  }

  /**
   * Get retrieval statistics
   */
  getStats(): RetrievalStats {
    return {
      queryCount: this.queryCount,
      averageResponseTime:
        this.queryCount > 0 ? this.totalResponseTime / this.queryCount : 0,
      cacheHitRate: embeddingsService.getCacheStats().size > 0 ? 0.5 : 0 // Estimate
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryCount = 0;
    this.totalResponseTime = 0;
  }
}

// Singleton instance
export const retriever = new RetrieverService();
export default RetrieverService;
