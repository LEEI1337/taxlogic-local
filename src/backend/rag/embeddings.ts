/**
 * TaxLogic.local - Embeddings Service
 *
 * Local embeddings generation using Ollama:
 * - nomic-embed-text model (384 dimensions)
 * - Batch processing support
 * - Caching for performance
 */

// Ollama embeddings - no external service import needed

// ========================================
// Type Definitions
// ========================================

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  processingTime: number;
}

// ========================================
// Constants
// ========================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text:latest';
// nomic-embed-text outputs 768-dimensional vectors

// Simple in-memory cache
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 10000;

// ========================================
// Embeddings Service Class
// ========================================

export class EmbeddingsService {
  private model: string;
  private baseUrl: string;

  constructor(model: string = EMBEDDING_MODEL, baseUrl: string = OLLAMA_BASE_URL) {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the embedding model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) return false;

      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];

      return models.some((m: string) => m.includes('nomic-embed') || m.includes('embed'));
    } catch {
      return false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      return {
        text,
        embedding: cached,
        model: this.model,
        dimensions: cached.length
      };
    }

    // Generate embedding via Ollama
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.embedding as number[];

    // Cache the result
    this.addToCache(cacheKey, embedding);

    return {
      text,
      embedding,
      model: this.model,
      dimensions: embedding.length
    };
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    const results: EmbeddingResult[] = [];
    let totalTokens = 0;

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((text) => this.embed(text)));
      results.push(...batchResults);
      totalTokens += batch.reduce((sum, text) => sum + this.estimateTokens(text), 0);
    }

    const processingTime = Date.now() - startTime;

    return {
      results,
      totalTokens,
      processingTime
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar texts from a set of embeddings
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidates: { id: string; embedding: number[]; text: string }[],
    topK: number = 5
  ): { id: string; text: string; similarity: number }[] {
    const similarities = candidates.map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding)
    }));

    // Sort by similarity (descending) and take top K
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Estimate token count for a text (rough estimate)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for German text
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate cache key from text
   */
  private getCacheKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.model}_${hash}`;
  }

  /**
   * Add embedding to cache
   */
  private addToCache(key: string, embedding: number[]): void {
    // Evict oldest entries if cache is full
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) embeddingCache.delete(firstKey);
    }
    embeddingCache.set(key, embedding);
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    embeddingCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: embeddingCache.size,
      maxSize: MAX_CACHE_SIZE
    };
  }
}

// Singleton instance
export const embeddingsService = new EmbeddingsService();
export default EmbeddingsService;
