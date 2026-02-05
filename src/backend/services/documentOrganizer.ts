/**
 * TaxLogic.local - Document Organizer Service
 *
 * Handles document classification and file organization:
 * - AI-powered expense categorization
 * - File organization by category
 * - Document manifest generation
 */

import * as fs from 'fs';
import * as path from 'path';

import { llmService } from './llmService';
import { ocrService, OCRResult, ExtractedData } from './ocrService';

// ========================================
// Type Definitions
// ========================================

export type ExpenseCategory =
  | 'pendler'           // Pendlerpauschale - Commute
  | 'homeoffice'        // Home Office
  | 'fortbildung'       // Professional education
  | 'arbeitsmittel'     // Work equipment
  | 'medizin'           // Medical expenses
  | 'spenden'           // Donations (Sonderausgaben)
  | 'kinderbetreuung'   // Childcare
  | 'versicherung'      // Insurance
  | 'werbungskosten'    // General work expenses
  | 'sonstige';         // Other

export interface ClassificationResult {
  category: ExpenseCategory;
  subcategory?: string;
  confidence: number;
  reasoning: string;
  suggestedDescription: string;
}

export interface OrganizedFile {
  originalPath: string;
  newPath: string;
  category: ExpenseCategory;
  filename: string;
}

export interface DocumentManifest {
  userId: string;
  taxYear: number;
  generatedAt: string;
  totalDocuments: number;
  totalAmount: number;
  byCategory: CategorySummary[];
}

export interface CategorySummary {
  category: ExpenseCategory;
  count: number;
  totalAmount: number;
  files: string[];
}

// ========================================
// Category Descriptions (Austrian Tax Law)
// ========================================

const CATEGORY_DESCRIPTIONS: Record<ExpenseCategory, string> = {
  pendler: 'Pendlerpauschale - Fahrtkosten zwischen Wohnung und Arbeitsstätte (Jahreskarte, Benzinkosten, Parkgebühren)',
  homeoffice: 'Home Office Pauschale - Kosten für Heimarbeit (Büromöbel, Internet, Heizung anteilig)',
  fortbildung: 'Fortbildungskosten - Berufliche Weiterbildung (Kurse, Seminare, Fachliteratur, Konferenzen)',
  arbeitsmittel: 'Arbeitsmittel - Beruflich genutzte Geräte (Computer, Software, Werkzeuge)',
  medizin: 'Außergewöhnliche Belastungen - Medizinische Ausgaben (Arztkosten, Medikamente, Therapien)',
  spenden: 'Sonderausgaben - Spenden an begünstigte Empfänger',
  kinderbetreuung: 'Kinderbetreuungskosten - Kosten für Kinderbetreuung bis 10 Jahre',
  versicherung: 'Versicherungen - Bestimmte Versicherungsbeiträge (Lebensversicherung, Krankenversicherung)',
  werbungskosten: 'Werbungskosten - Sonstige berufliche Aufwendungen',
  sonstige: 'Sonstige Ausgaben - Nicht kategorisierbare Belege'
};

// ========================================
// Document Organizer Service Class
// ========================================

class DocumentOrganizerService {
  private baseDocumentPath: string;

  constructor() {
    this.baseDocumentPath = path.join(process.cwd(), 'data', 'documents');
  }

  /**
   * Set the base document storage path
   */
  setBasePath(basePath: string): void {
    this.baseDocumentPath = basePath;
  }

  /**
   * Classify a document using AI based on OCR text
   */
  async classifyDocument(ocrText: string, extractedData?: ExtractedData): Promise<ClassificationResult> {
    const systemPrompt = `Du bist ein Experte für österreichisches Steuerrecht und klassifizierst Belege für die Arbeitnehmerveranlagung.

Kategorien und deren Bedeutung:
${Object.entries(CATEGORY_DESCRIPTIONS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')}

Analysiere den Belegtext und bestimme:
1. Die passende Hauptkategorie
2. Eine optionale Unterkategorie
3. Deine Konfidenz (0.0 - 1.0)
4. Eine kurze Begründung
5. Eine vorgeschlagene Beschreibung für den Beleg

Antworte ausschließlich im folgenden JSON-Format:
{
  "category": "kategorie_name",
  "subcategory": "optional_unterkategorie",
  "confidence": 0.85,
  "reasoning": "Kurze Begründung",
  "suggestedDescription": "Beschreibung für Beleg"
}`;

    const userPrompt = `Klassifiziere folgenden Beleg:

OCR-Text:
${ocrText.substring(0, 2000)}

${extractedData ? `
Extrahierte Daten:
- Betrag: ${extractedData.totalAmount || 'nicht erkannt'} ${extractedData.currency}
- Datum: ${extractedData.dates[0]?.raw || 'nicht erkannt'}
- Firma: ${extractedData.vendor || 'nicht erkannt'}
` : ''}`;

    try {
      const response = await llmService.query(userPrompt, [], systemPrompt);

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate category
      const validCategories: ExpenseCategory[] = [
        'pendler', 'homeoffice', 'fortbildung', 'arbeitsmittel',
        'medizin', 'spenden', 'kinderbetreuung', 'versicherung',
        'werbungskosten', 'sonstige'
      ];

      if (!validCategories.includes(result.category)) {
        result.category = 'sonstige';
        result.confidence = 0.5;
      }

      return {
        category: result.category as ExpenseCategory,
        subcategory: result.subcategory,
        confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
        reasoning: result.reasoning || 'Automatisch klassifiziert',
        suggestedDescription: result.suggestedDescription || 'Beleg'
      };
    } catch (error) {
      console.error('[DocumentOrganizer] Classification failed:', error);

      // Fallback classification based on keywords
      return this.fallbackClassification(ocrText);
    }
  }

  /**
   * Fallback classification using keyword matching
   */
  private fallbackClassification(text: string): ClassificationResult {
    const lowerText = text.toLowerCase();

    // Keyword mapping
    const keywordMap: Array<{ keywords: string[]; category: ExpenseCategory }> = [
      { keywords: ['öbb', 'wiener linien', 'ticket', 'fahrkarte', 'jahreskarte', 'benzin', 'tankstelle'], category: 'pendler' },
      { keywords: ['ikea', 'bürostuhl', 'schreibtisch', 'internet', 'a1', 'magenta'], category: 'homeoffice' },
      { keywords: ['kurs', 'seminar', 'weiterbildung', 'workshop', 'konferenz', 'buch', 'fachbuch'], category: 'fortbildung' },
      { keywords: ['laptop', 'computer', 'software', 'microsoft', 'adobe', 'werkzeug'], category: 'arbeitsmittel' },
      { keywords: ['apotheke', 'arzt', 'medikament', 'therapie', 'krankenhaus', 'ordination'], category: 'medizin' },
      { keywords: ['spende', 'rotes kreuz', 'caritas', 'donation', 'hilfswerk'], category: 'spenden' },
      { keywords: ['kindergarten', 'kinderbetreuung', 'hort', 'babysitter'], category: 'kinderbetreuung' },
      { keywords: ['versicherung', 'uniqa', 'wiener städtische', 'generali', 'allianz'], category: 'versicherung' }
    ];

    for (const { keywords, category } of keywordMap) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return {
            category,
            confidence: 0.6,
            reasoning: `Keyword-basierte Klassifizierung: "${keyword}" gefunden`,
            suggestedDescription: `Beleg (${keyword})`
          };
        }
      }
    }

    // Default to sonstige
    return {
      category: 'sonstige',
      confidence: 0.3,
      reasoning: 'Keine eindeutigen Keywords gefunden',
      suggestedDescription: 'Nicht klassifizierter Beleg'
    };
  }

  /**
   * Organize a file into the appropriate category folder
   */
  async organizeFile(
    filePath: string,
    category: ExpenseCategory,
    userId: string,
    taxYear: number
  ): Promise<OrganizedFile> {
    // Create directory structure: data/documents/{userId}/{taxYear}/{category}/
    const targetDir = path.join(
      this.baseDocumentPath,
      userId,
      taxYear.toString(),
      category
    );

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate unique filename
    const originalExt = path.extname(filePath);
    const originalName = path.basename(filePath, originalExt);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFilename = `${originalName}_${timestamp}${originalExt}`;
    const newPath = path.join(targetDir, newFilename);

    // Copy file to new location
    fs.copyFileSync(filePath, newPath);

    console.log(`[DocumentOrganizer] Organized: ${filePath} -> ${newPath}`);

    return {
      originalPath: filePath,
      newPath,
      category,
      filename: newFilename
    };
  }

  /**
   * Process a document: OCR + classify + organize
   */
  async processDocument(
    filePath: string,
    userId: string,
    taxYear: number
  ): Promise<{
    ocrResult: OCRResult;
    extractedData: ExtractedData;
    classification: ClassificationResult;
    organized: OrganizedFile;
  }> {
    console.log(`[DocumentOrganizer] Processing document: ${filePath}`);

    // Step 1: OCR
    const ocrResult = await ocrService.processImage(filePath);

    // Step 2: Extract structured data
    const extractedData = ocrService.extractStructuredData(ocrResult);

    // Step 3: Classify
    const classification = await this.classifyDocument(ocrResult.text, extractedData);

    // Step 4: Organize
    const organized = await this.organizeFile(filePath, classification.category, userId, taxYear);

    return {
      ocrResult,
      extractedData,
      classification,
      organized
    };
  }

  /**
   * Build a document manifest for a user/tax year
   */
  async buildManifest(userId: string, taxYear: number): Promise<DocumentManifest> {
    const userDir = path.join(this.baseDocumentPath, userId, taxYear.toString());

    const manifest: DocumentManifest = {
      userId,
      taxYear,
      generatedAt: new Date().toISOString(),
      totalDocuments: 0,
      totalAmount: 0,
      byCategory: []
    };

    if (!fs.existsSync(userDir)) {
      return manifest;
    }

    // Scan all category directories
    const categories = fs.readdirSync(userDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name as ExpenseCategory);

    for (const category of categories) {
      const categoryDir = path.join(userDir, category);
      const files = fs.readdirSync(categoryDir).filter((f) => !f.startsWith('.'));

      const summary: CategorySummary = {
        category,
        count: files.length,
        totalAmount: 0, // Would need to read from DB or re-OCR
        files
      };

      manifest.byCategory.push(summary);
      manifest.totalDocuments += files.length;
    }

    return manifest;
  }

  /**
   * Get category description
   */
  getCategoryDescription(category: ExpenseCategory): string {
    return CATEGORY_DESCRIPTIONS[category] || 'Unbekannte Kategorie';
  }

  /**
   * Get all category names and descriptions
   */
  getAllCategories(): Array<{ key: ExpenseCategory; description: string }> {
    return Object.entries(CATEGORY_DESCRIPTIONS).map(([key, description]) => ({
      key: key as ExpenseCategory,
      description
    }));
  }

  /**
   * Delete a document
   */
  deleteDocument(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[DocumentOrganizer] Deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[DocumentOrganizer] Delete failed: ${filePath}`, error);
      return false;
    }
  }
}

// Singleton instance
export const documentOrganizer = new DocumentOrganizerService();
export default DocumentOrganizerService;
