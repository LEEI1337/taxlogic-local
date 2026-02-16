/**
 * TaxLogic.local - Knowledge Base Service
 *
 * Vector store for Austrian tax law knowledge:
 * - Year-versioned default knowledge loading
 * - Document ingestion and chunking
 * - Semantic search
 */

import * as fs from 'fs';
import * as path from 'path';

import { getConfigRoot } from '../taxRules/loader';

import { embeddingsService } from './embeddings';

// ========================================
// Type Definitions
// ========================================

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  category: KnowledgeCategory;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type KnowledgeCategory =
  | 'einkommensteuergesetz'
  | 'werbungskosten'
  | 'sonderausgaben'
  | 'pendlerpauschale'
  | 'homeoffice'
  | 'familienbonus'
  | 'finanzamt'
  | 'formulare'
  | 'allgemein';

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  title: string;
  category: KnowledgeCategory;
  source: string;
  chunkIndex: number;
  totalChunks: number;
  sourceYear: number;
  lawYear: number;
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  similarity: number;
  document: KnowledgeDocument;
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  categories: Record<KnowledgeCategory, number>;
  lastUpdated: string;
  activeYear: number | null;
}

interface ParsedKnowledgeFile {
  title: string;
  source: string;
  category: KnowledgeCategory;
  content: string;
  sourceYear: number;
  metadata: Record<string, unknown>;
}

const VALID_CATEGORIES: KnowledgeCategory[] = [
  'einkommensteuergesetz',
  'werbungskosten',
  'sonderausgaben',
  'pendlerpauschale',
  'homeoffice',
  'familienbonus',
  'finanzamt',
  'formulare',
  'allgemein'
];

function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return VALID_CATEGORIES.includes(value as KnowledgeCategory);
}

function getDefaultTaxYear(): number {
  return new Date().getFullYear() - 1;
}

function parseMetadataLine(
  line: string,
  metadata: Record<string, unknown>
): void {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    return;
  }

  const key = line.slice(0, separatorIndex).trim().toLowerCase();
  const value = line.slice(separatorIndex + 1).trim();

  if (key.length === 0 || value.length === 0) {
    return;
  }

  metadata[key] = value;
}

// ========================================
// Knowledge Base Service Class
// ========================================

export class KnowledgeBaseService {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private knowledgePath: string;
  private initialized = false;
  private activeYear: number | null = null;

  constructor() {
    this.knowledgePath = path.join(process.cwd(), 'data', 'knowledge');
  }

  /**
   * Initialize the knowledge base for a given tax year.
   */
  async initialize(year: number = getDefaultTaxYear()): Promise<void> {
    if (this.initialized && this.activeYear === year) {
      return;
    }

    this.clearInternal();
    this.activeYear = year;

    // Ensure custom knowledge directory exists
    if (!fs.existsSync(this.knowledgePath)) {
      fs.mkdirSync(this.knowledgePath, { recursive: true });
    }

    await this.loadYearKnowledgeFromConfig(year);
    await this.loadCustomKnowledgeFromDisk(year);

    this.initialized = true;
    console.log(
      `[KnowledgeBase] Initialized for ${year} with ${this.documents.size} documents, ${this.chunks.size} chunks`
    );
  }

  /**
   * Explicit year switch helper.
   */
  async switchYear(year: number): Promise<void> {
    await this.initialize(year);
  }

  getActiveYear(): number | null {
    return this.activeYear;
  }

  /**
   * Add a document to the knowledge base
   */
  async addDocument(input: Omit<KnowledgeDocument, 'id' | 'createdAt'>): Promise<KnowledgeDocument> {
    const sourceYear = Number(input.metadata.sourceYear ?? this.activeYear ?? getDefaultTaxYear());
    const lawYear = Number(input.metadata.lawYear ?? sourceYear);

    const doc: KnowledgeDocument = {
      ...input,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      metadata: {
        ...input.metadata,
        sourceYear,
        lawYear
      }
    };

    this.documents.set(doc.id, doc);

    // Chunk the document
    const textChunks = this.chunkText(doc.content);

    // Generate embeddings for each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];
      const embedding = await embeddingsService.embed(chunkText);

      const chunk: KnowledgeChunk = {
        id: `chunk_${doc.id}_${i}`,
        documentId: doc.id,
        content: chunkText,
        embedding: embedding.embedding,
        metadata: {
          title: doc.title,
          category: doc.category,
          source: doc.source,
          chunkIndex: i,
          totalChunks: textChunks.length,
          sourceYear,
          lawYear
        }
      };

      this.chunks.set(chunk.id, chunk);
    }

    return doc;
  }

  /**
   * Search the knowledge base
   */
  async search(query: string, topK: number = 5, category?: KnowledgeCategory): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate query embedding
    const queryEmbedding = await embeddingsService.embed(query);

    // Filter chunks by category if specified
    let candidateChunks = Array.from(this.chunks.values());
    if (category) {
      candidateChunks = candidateChunks.filter((c) => c.metadata.category === category);
    }

    // Find most similar chunks
    const similarities = candidateChunks.map((chunk) => ({
      chunk,
      similarity: embeddingsService.cosineSimilarity(queryEmbedding.embedding, chunk.embedding)
    }));

    // Sort and take top K
    const topResults = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);

    // Add document info to results
    return topResults.map((result) => ({
      chunk: result.chunk,
      similarity: result.similarity,
      document: this.documents.get(result.chunk.documentId)!
    }));
  }

  /**
   * Get context for a query (for RAG)
   */
  async getContext(query: string, maxTokens: number = 2000): Promise<string> {
    const results = await this.search(query, 5);

    let context = '';
    let currentTokens = 0;

    for (const result of results) {
      const chunkText = `### ${result.chunk.metadata.title}\n${result.chunk.content}\n\n`;
      const chunkTokens = Math.ceil(chunkText.length / 4);

      if (currentTokens + chunkTokens > maxTokens) {
        break;
      }

      context += chunkText;
      currentTokens += chunkTokens;
    }

    return context;
  }

  /**
   * Chunk text into smaller pieces
   */
  private chunkText(text: string, maxChunkSize: number = 500): string[] {
    const chunks: string[] = [];

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (paragraph.length > maxChunkSize) {
        // Split long paragraphs by sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          currentChunk += sentence + ' ';
        }
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async loadYearKnowledgeFromConfig(year: number): Promise<void> {
    const configRoot = getConfigRoot();
    const yearDirectory = path.join(configRoot, 'tax-knowledge', String(year));

    if (!fs.existsSync(yearDirectory)) {
      throw new Error(
        `Missing tax knowledge package for year ${year}: ${yearDirectory}. Run tax-rules:sync-rag.`
      );
    }

    const files = fs.readdirSync(yearDirectory).filter((file) => file.endsWith('.md'));
    if (files.length === 0) {
      throw new Error(
        `No markdown knowledge files found for year ${year} in ${yearDirectory}.`
      );
    }

    for (const file of files) {
      const filePath = path.join(yearDirectory, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.parseMarkdownKnowledgeFile(raw, file, year);

      await this.addDocument({
        title: parsed.title,
        content: parsed.content,
        source: parsed.source,
        category: parsed.category,
        metadata: parsed.metadata
      });
    }
  }

  private parseMarkdownKnowledgeFile(
    raw: string,
    filename: string,
    year: number
  ): ParsedKnowledgeFile {
    const lines = raw.split(/\r?\n/);

    let lineIndex = 0;
    let title = filename;
    if (lines[0]?.startsWith('#')) {
      title = lines[0].replace(/^#+\s*/, '').trim() || filename;
      lineIndex = 1;
    }

    const metadata: Record<string, unknown> = {
      file: filename,
      sourceYear: year,
      lawYear: year
    };

    while (lineIndex < lines.length) {
      const line = lines[lineIndex].trim();
      if (!line) {
        lineIndex++;
        break;
      }

      parseMetadataLine(line, metadata);
      lineIndex++;
    }

    const source = typeof metadata.source === 'string' ? metadata.source : filename;
    const categoryCandidate =
      typeof metadata.category === 'string'
        ? metadata.category.toLowerCase().trim()
        : 'allgemein';
    const category = isKnowledgeCategory(categoryCandidate)
      ? categoryCandidate
      : 'allgemein';

    const yearFromMetadata = Number(metadata.year);
    if (!Number.isNaN(yearFromMetadata) && yearFromMetadata > 0) {
      metadata.sourceYear = yearFromMetadata;
      metadata.lawYear = yearFromMetadata;
    }

    const body = lines.slice(lineIndex).join('\n').trim();

    return {
      title,
      source,
      category,
      content: body,
      sourceYear: year,
      metadata
    };
  }

  /**
   * Load custom knowledge files from data/knowledge.
   */
  private async loadCustomKnowledgeFromDisk(year: number): Promise<void> {
    if (!fs.existsSync(this.knowledgePath)) {
      return;
    }

    const files = fs.readdirSync(this.knowledgePath);

    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        try {
          const filePath = path.join(this.knowledgePath, file);
          const content = fs.readFileSync(filePath, 'utf-8');

          // Extract title from first line
          const lines = content.split('\n');
          const title = lines[0].replace(/^#\s*/, '').trim() || file;
          const body = lines.slice(1).join('\n').trim();

          await this.addDocument({
            title,
            content: body,
            source: file,
            category: 'allgemein',
            metadata: { file, sourceYear: year, lawYear: year }
          });
        } catch (error) {
          console.error(`[KnowledgeBase] Error loading ${file}:`, error);
        }
      }
    }
  }

  /**
   * Get statistics about the knowledge base
   */
  getStats(): KnowledgeBaseStats {
    const categories: Record<KnowledgeCategory, number> = {
      einkommensteuergesetz: 0,
      werbungskosten: 0,
      sonderausgaben: 0,
      pendlerpauschale: 0,
      homeoffice: 0,
      familienbonus: 0,
      finanzamt: 0,
      formulare: 0,
      allgemein: 0
    };

    this.documents.forEach((doc) => {
      categories[doc.category]++;
    });

    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.size,
      categories,
      lastUpdated: new Date().toISOString(),
      activeYear: this.activeYear
    };
  }

  /**
   * Get all documents
   */
  getAllDocuments(): KnowledgeDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): KnowledgeDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Delete a document
   */
  deleteDocument(id: string): boolean {
    // Remove document
    const deleted = this.documents.delete(id);

    // Remove associated chunks
    Array.from(this.chunks.keys())
      .filter((key) => key.includes(id))
      .forEach((key) => this.chunks.delete(key));

    return deleted;
  }

  /**
   * Clear all knowledge
   */
  clear(): void {
    this.clearInternal();
    this.activeYear = null;
    this.initialized = false;
  }

  private clearInternal(): void {
    this.documents.clear();
    this.chunks.clear();
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBaseService();
export default KnowledgeBaseService;
