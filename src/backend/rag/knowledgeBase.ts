/**
 * TaxLogic.local - Knowledge Base Service
 *
 * Vector store for Austrian tax law knowledge:
 * - Document ingestion and chunking
 * - Vector storage (in-memory or Qdrant)
 * - Semantic search
 */

import * as fs from 'fs';
import * as path from 'path';

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
}

// ========================================
// Default Austrian Tax Knowledge
// ========================================

const DEFAULT_KNOWLEDGE: Omit<KnowledgeDocument, 'id' | 'createdAt'>[] = [
  {
    title: 'Werbungskosten - Grundlagen',
    content: `Werbungskosten sind alle Aufwendungen zur Erwerbung, Sicherung und Erhaltung von Einnahmen aus nichtselbständiger Arbeit.

Wichtige Kategorien von Werbungskosten:
1. Pendlerpauschale - Fahrtkosten zur Arbeit
2. Arbeitsmittel - Computer, Software, Fachliteratur
3. Fortbildungskosten - Kurse, Seminare, Studium
4. Home Office Pauschale - bis zu €300 pro Jahr
5. Reisekosten - berufliche Reisen
6. Doppelte Haushaltsführung

Die Werbungskostenpauschale beträgt €132 pro Jahr und wird automatisch berücksichtigt.
Höhere Werbungskosten müssen nachgewiesen werden.`,
    source: 'Einkommensteuergesetz §16',
    category: 'werbungskosten',
    metadata: { year: 2024 }
  },
  {
    title: 'Pendlerpauschale - Berechnung',
    content: `Die Pendlerpauschale ist eine Pauschale für Fahrten zwischen Wohnung und Arbeitsstätte.

Kleine Pendlerpauschale (öffentliche Verkehrsmittel zumutbar):
- 20-40 km: €696 pro Jahr
- 40-60 km: €1.356 pro Jahr
- über 60 km: €2.016 pro Jahr

Große Pendlerpauschale (öffentliche Verkehrsmittel nicht zumutbar):
- 2-20 km: €372 pro Jahr
- 20-40 km: €1.476 pro Jahr
- 40-60 km: €2.568 pro Jahr
- über 60 km: €3.672 pro Jahr

Unzumutbarkeit liegt vor wenn:
- Keine öffentlichen Verkehrsmittel verfügbar
- Gesamtfahrzeit (hin und retour) über 2,5 Stunden
- Gehbehinderung oder andere zwingende Gründe

Nachweis über den Pendlerrechner auf bmf.gv.at.`,
    source: 'Pendlerförderungsgesetz',
    category: 'pendlerpauschale',
    metadata: { year: 2024 }
  },
  {
    title: 'Home Office Pauschale',
    content: `Die Home Office Pauschale gilt für Arbeit im privaten Wohnbereich.

Voraussetzungen:
- Arbeitgeber hat Home Office angeordnet oder vereinbart
- Kein eigenes Arbeitszimmer

Höhe der Pauschale:
- €3 pro Home Office Tag
- Maximum €300 pro Jahr (entspricht 100 Tagen)

Zusätzlich absetzbar:
- Ergonomische Möbel (Schreibtisch, Bürostuhl) bis €300
- Digitale Arbeitsmittel (anteilig)

Nachweis:
- Bestätigung des Arbeitgebers
- Aufzeichnung der Home Office Tage

Die Home Office Pauschale zählt zu den Werbungskosten.`,
    source: 'Einkommensteuergesetz §16 Abs. 1 Z 7a',
    category: 'homeoffice',
    metadata: { year: 2024 }
  },
  {
    title: 'Sonderausgaben',
    content: `Sonderausgaben sind bestimmte private Ausgaben, die steuerlich begünstigt sind.

Wichtige Sonderausgaben:
1. Kirchenbeitrag - max. €600 pro Jahr
2. Spenden an begünstigte Organisationen - bis 10% des Einkommens
3. Freiwillige Weiterversicherung in der Pensionsversicherung
4. Nachkauf von Versicherungszeiten

Besonderheiten:
- Kirchenbeitrag und Spenden werden meist automatisch gemeldet
- Prüfen Sie den Databoxauszug auf korrekte Übermittlung
- Topfsonderausgaben (Versicherungen) laufen 2025 aus`,
    source: 'Einkommensteuergesetz §18',
    category: 'sonderausgaben',
    metadata: { year: 2024 }
  },
  {
    title: 'Familienbonus Plus',
    content: `Der Familienbonus Plus ist ein Steuerabsetzbetrag für Kinder.

Höhe des Familienbonus Plus:
- Kinder bis 18 Jahre: €2.000 pro Kind und Jahr
- Kinder ab 18 Jahre (mit Familienbeihilfe): €650 pro Kind und Jahr

Voraussetzungen:
- Anspruch auf Familienbeihilfe
- Das Kind lebt im Haushalt oder es werden Unterhaltszahlungen geleistet

Aufteilung:
- Kann zwischen Eltern aufgeteilt werden
- 100% / 0% oder 50% / 50%
- Monatsgenaue Aufteilung möglich

Der Familienbonus wird direkt von der Steuerschuld abgezogen (Steuerabsetzbetrag).`,
    source: 'Einkommensteuergesetz §33 Abs. 3a',
    category: 'familienbonus',
    metadata: { year: 2024 }
  },
  {
    title: 'Außergewöhnliche Belastungen - Krankheitskosten',
    content: `Krankheitskosten können als außergewöhnliche Belastung geltend gemacht werden.

Absetzbare Kosten:
- Arztkosten und Behandlungen
- Medikamente und Heilbehelfe
- Spitalskosten
- Fahrtkosten zu Behandlungen
- Brillen und Kontaktlinsen
- Zahnbehandlungen und Zahnersatz

Selbstbehalt:
Je nach Einkommen und Familiensituation muss ein Selbstbehalt überschritten werden:
- 6-12% des Einkommens (je nach Situation)
- Bei Behinderung entfällt der Selbstbehalt

Wichtig: Kosten, die von der Krankenkasse oder Versicherung erstattet wurden, können nicht abgesetzt werden.`,
    source: 'Einkommensteuergesetz §34',
    category: 'allgemein',
    metadata: { year: 2024 }
  },
  {
    title: 'FinanzOnline - Arbeitnehmerveranlagung',
    content: `FinanzOnline ist das elektronische Portal des Finanzamts für Steuererklärungen.

Zugang zu FinanzOnline:
- Mit Handysignatur / ID Austria
- Mit FinanzOnline-Zugangsdaten
- Erstanmeldung: Aktivierungscode per Post

Arbeitnehmerveranlagung einreichen:
1. Anmelden bei finanzonline.bmf.gv.at
2. "Eingaben" > "Erklärungen" > "Arbeitnehmerveranlagung (L1)"
3. Jahr auswählen
4. Daten eingeben oder automatische Übernahme nutzen
5. Prüfen und absenden

Fristen:
- Freiwillige Veranlagung: bis 5 Jahre rückwirkend
- Pflichtveranlagung: bis 30. September des Folgejahres

Tipp: Nutzen Sie die Vorausfüllung - viele Daten sind bereits hinterlegt.`,
    source: 'BMF Finanzamt',
    category: 'finanzamt',
    metadata: { year: 2024 }
  },
  {
    title: 'Formulare L1, L1ab, L1k',
    content: `Die wichtigsten Formulare für die Arbeitnehmerveranlagung:

L1 - Arbeitnehmerveranlagung (Hauptformular):
- Persönliche Daten
- Werbungskosten
- Sonderausgaben
- Außergewöhnliche Belastungen
- Bankverbindung

L1ab - Beilage für zusätzliche Einkünfte:
- Einkünfte aus selbstständiger Arbeit
- Einkünfte aus Vermietung
- Kapitaleinkünfte
- Nur erforderlich bei Nebeneinkünften

L1k - Beilage für Kinder:
- Angaben zu Kindern
- Familienbonus Plus
- Kinderbetreuungskosten
- Alleinverdiener/Alleinerzieher

Die Formulare können elektronisch über FinanzOnline oder als PDF eingereicht werden.`,
    source: 'BMF Formulare',
    category: 'formulare',
    metadata: { year: 2024 }
  }
];

// ========================================
// Knowledge Base Service Class
// ========================================

export class KnowledgeBaseService {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private knowledgePath: string;
  private initialized: boolean = false;

  constructor() {
    this.knowledgePath = path.join(process.cwd(), 'data', 'knowledge');
  }

  /**
   * Initialize the knowledge base
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[KnowledgeBase] Initializing...');

    // Ensure directory exists
    if (!fs.existsSync(this.knowledgePath)) {
      fs.mkdirSync(this.knowledgePath, { recursive: true });
    }

    // Load default knowledge
    for (const doc of DEFAULT_KNOWLEDGE) {
      await this.addDocument(doc);
    }

    // Load custom knowledge files from disk
    await this.loadFromDisk();

    this.initialized = true;
    console.log(`[KnowledgeBase] Initialized with ${this.documents.size} documents, ${this.chunks.size} chunks`);
  }

  /**
   * Add a document to the knowledge base
   */
  async addDocument(input: Omit<KnowledgeDocument, 'id' | 'createdAt'>): Promise<KnowledgeDocument> {
    const doc: KnowledgeDocument = {
      ...input,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
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
          totalChunks: textChunks.length
        }
      };

      this.chunks.set(chunk.id, chunk);
    }

    console.log(`[KnowledgeBase] Added document: ${doc.title} (${textChunks.length} chunks)`);

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
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

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
      const chunkTokens = Math.ceil(chunkText.length / 4); // Rough estimate

      if (currentTokens + chunkTokens > maxTokens) break;

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

  /**
   * Load knowledge from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!fs.existsSync(this.knowledgePath)) return;

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
            metadata: { file }
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
      lastUpdated: new Date().toISOString()
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
    this.documents.clear();
    this.chunks.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBaseService();
export default KnowledgeBaseService;
