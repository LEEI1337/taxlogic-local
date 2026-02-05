/**
 * TaxLogic.local - Document Inspector Agent
 *
 * AI agent that processes and analyzes documents:
 * - OCR text extraction
 * - Intelligent classification
 * - Data extraction (amounts, dates, vendors)
 * - Quality assessment
 */

import * as path from 'path';
import * as fs from 'fs';

import { llmService } from '../services/llmService';
import { ocrService, OCRResult, ExtractedData } from '../services/ocrService';
import { documentOrganizer, ExpenseCategory, ClassificationResult } from '../services/documentOrganizer';

// ========================================
// Type Definitions
// ========================================

export interface DocumentAnalysis {
  id: string;
  filename: string;
  filePath: string;
  fileType: string;
  fileSize: number;

  // OCR Results
  ocrResult: OCRResult;
  ocrQuality: OCRQuality;

  // Extracted Information
  extractedData: ExtractedData;

  // Classification
  classification: ClassificationResult;

  // AI Analysis
  aiAnalysis: AIAnalysisResult;

  // Timestamps
  processedAt: string;
  processingTime: number;
}

export interface OCRQuality {
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

export interface AIAnalysisResult {
  summary: string;
  keyFindings: string[];
  taxRelevance: 'high' | 'medium' | 'low' | 'none';
  suggestedCategory: ExpenseCategory;
  suggestedAmount: number | null;
  suggestedDate: string | null;
  warnings: string[];
  recommendations: string[];
}

export interface BatchProcessingResult {
  successful: DocumentAnalysis[];
  failed: FailedDocument[];
  summary: ProcessingSummary;
}

export interface FailedDocument {
  filename: string;
  filePath: string;
  error: string;
}

export interface ProcessingSummary {
  totalDocuments: number;
  successfulCount: number;
  failedCount: number;
  totalAmount: number;
  byCategory: Record<ExpenseCategory, { count: number; amount: number }>;
  processingTime: number;
}

// ========================================
// Document Inspector Agent Class
// ========================================

export class DocumentInspectorAgent {
  private initialized: boolean = false;

  /**
   * Initialize the agent (loads OCR models)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[DocumentInspector] Initializing...');
    await ocrService.initialize();
    this.initialized = true;
    console.log('[DocumentInspector] Initialized');
  }

  /**
   * Process a single document
   */
  async processDocument(filePath: string): Promise<DocumentAnalysis> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const filename = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    const fileStats = fs.statSync(filePath);

    console.log(`[DocumentInspector] Processing: ${filename}`);

    // Step 1: OCR
    let ocrResult: OCRResult;
    if (['.pdf'].includes(fileExt)) {
      // For now, skip PDF (would need conversion to images)
      throw new Error('PDF-Verarbeitung noch nicht implementiert. Bitte laden Sie Bilder hoch.');
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(fileExt)) {
      ocrResult = await ocrService.processImage(filePath);
    } else {
      throw new Error(`Nicht unterstütztes Dateiformat: ${fileExt}`);
    }

    // Step 2: Assess OCR quality
    const ocrQuality = this.assessOCRQuality(ocrResult);

    // Step 3: Extract structured data
    const extractedData = ocrService.extractStructuredData(ocrResult);

    // Step 4: Basic classification
    const classification = await documentOrganizer.classifyDocument(ocrResult.text, extractedData);

    // Step 5: AI-powered deep analysis
    const aiAnalysis = await this.performAIAnalysis(ocrResult, extractedData, classification);

    const processingTime = Date.now() - startTime;

    const analysis: DocumentAnalysis = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename,
      filePath,
      fileType: fileExt,
      fileSize: fileStats.size,
      ocrResult,
      ocrQuality,
      extractedData,
      classification,
      aiAnalysis,
      processedAt: new Date().toISOString(),
      processingTime
    };

    console.log(`[DocumentInspector] Completed: ${filename} in ${processingTime}ms`);

    return analysis;
  }

  /**
   * Process multiple documents
   */
  async processDocuments(filePaths: string[]): Promise<BatchProcessingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const successful: DocumentAnalysis[] = [];
    const failed: FailedDocument[] = [];
    const categoryStats: Record<ExpenseCategory, { count: number; amount: number }> = {
      pendler: { count: 0, amount: 0 },
      homeoffice: { count: 0, amount: 0 },
      fortbildung: { count: 0, amount: 0 },
      arbeitsmittel: { count: 0, amount: 0 },
      medizin: { count: 0, amount: 0 },
      spenden: { count: 0, amount: 0 },
      kinderbetreuung: { count: 0, amount: 0 },
      versicherung: { count: 0, amount: 0 },
      werbungskosten: { count: 0, amount: 0 },
      sonstige: { count: 0, amount: 0 }
    };

    let totalAmount = 0;

    for (const filePath of filePaths) {
      try {
        const analysis = await this.processDocument(filePath);
        successful.push(analysis);

        // Update stats
        const category = analysis.classification.category;
        const amount = analysis.aiAnalysis.suggestedAmount || analysis.extractedData.totalAmount || 0;

        categoryStats[category].count++;
        categoryStats[category].amount += amount;
        totalAmount += amount;
      } catch (error) {
        failed.push({
          filename: path.basename(filePath),
          filePath,
          error: (error as Error).message
        });
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      successful,
      failed,
      summary: {
        totalDocuments: filePaths.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        totalAmount,
        byCategory: categoryStats,
        processingTime
      }
    };
  }

  /**
   * Assess OCR quality
   */
  private assessOCRQuality(ocrResult: OCRResult): OCRQuality {
    const issues: string[] = [];
    const recommendations: string[] = [];

    let score = ocrResult.confidence;

    // Check for low confidence
    if (ocrResult.confidence < 60) {
      issues.push('Niedrige OCR-Konfidenz - Text möglicherweise unvollständig');
      recommendations.push('Versuchen Sie, ein schärferes Bild mit besserer Beleuchtung zu machen');
    }

    // Check for short text
    if (ocrResult.text.length < 50) {
      issues.push('Sehr wenig Text erkannt');
      recommendations.push('Stellen Sie sicher, dass das gesamte Dokument sichtbar ist');
      score -= 20;
    }

    // Check for many low-confidence words
    const lowConfidenceWords = ocrResult.words.filter((w) => w.confidence < 50);
    if (lowConfidenceWords.length > ocrResult.words.length * 0.3) {
      issues.push('Viele Wörter mit niedriger Konfidenz');
      recommendations.push('Das Bild könnte verschwommen oder verzerrt sein');
      score -= 15;
    }

    // Check for numbers (important for receipts)
    const hasNumbers = /\d+[,.]?\d*/.test(ocrResult.text);
    if (!hasNumbers) {
      issues.push('Keine Zahlen/Beträge erkannt');
      recommendations.push('Stellen Sie sicher, dass Beträge gut lesbar sind');
    }

    // Check for dates
    const hasDate = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(ocrResult.text);
    if (!hasDate) {
      issues.push('Kein Datum erkannt');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations
    };
  }

  /**
   * Perform AI-powered analysis
   */
  private async performAIAnalysis(
    ocrResult: OCRResult,
    extractedData: ExtractedData,
    classification: ClassificationResult
  ): Promise<AIAnalysisResult> {
    try {
      const systemPrompt = `Du bist ein Experte für österreichisches Steuerrecht und analysierst Belege für die Arbeitnehmerveranlagung.

Deine Aufgabe:
1. Analysiere den OCR-Text eines Belegs
2. Bestimme, ob er steuerlich relevant ist
3. Extrahiere wichtige Informationen
4. Gib Empfehlungen

Antworte im JSON-Format:
{
  "summary": "Kurze Zusammenfassung des Belegs",
  "keyFindings": ["Wichtige Erkenntnisse"],
  "taxRelevance": "high|medium|low|none",
  "suggestedCategory": "kategorie",
  "suggestedAmount": 123.45,
  "suggestedDate": "2024-01-15",
  "warnings": ["Eventuelle Warnungen"],
  "recommendations": ["Empfehlungen"]
}`;

      const userPrompt = `Analysiere folgenden Beleg für die österreichische Arbeitnehmerveranlagung:

OCR-Text:
${ocrResult.text.substring(0, 2000)}

Bereits extrahierte Daten:
- Beträge: ${extractedData.amounts.map((a) => `${a.value} ${a.currency}`).join(', ') || 'keine'}
- Daten: ${extractedData.dates.map((d) => d.raw).join(', ') || 'keine'}
- Firma: ${extractedData.vendor || 'nicht erkannt'}
- Gesamtbetrag: ${extractedData.totalAmount || 'nicht erkannt'}

Vorläufige Klassifizierung: ${classification.category} (Konfidenz: ${classification.confidence})

Analysiere den Beleg und gib deine Einschätzung.`;

      const response = await llmService.query(userPrompt, [], systemPrompt);

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Keine Zusammenfassung verfügbar',
          keyFindings: parsed.keyFindings || [],
          taxRelevance: parsed.taxRelevance || 'medium',
          suggestedCategory: parsed.suggestedCategory || classification.category,
          suggestedAmount: parsed.suggestedAmount || extractedData.totalAmount || null,
          suggestedDate: parsed.suggestedDate || extractedData.dates[0]?.date.toISOString().split('T')[0] || null,
          warnings: parsed.warnings || [],
          recommendations: parsed.recommendations || []
        };
      }

      throw new Error('No JSON in response');
    } catch (error) {
      console.warn('[DocumentInspector] AI analysis failed, using fallback:', error);

      // Fallback analysis
      return {
        summary: `${classification.category} Beleg${extractedData.vendor ? ` von ${extractedData.vendor}` : ''}`,
        keyFindings: [
          extractedData.totalAmount ? `Betrag: €${extractedData.totalAmount}` : 'Betrag nicht erkannt',
          extractedData.dates[0] ? `Datum: ${extractedData.dates[0].raw}` : 'Datum nicht erkannt'
        ],
        taxRelevance: classification.confidence > 0.7 ? 'high' : 'medium',
        suggestedCategory: classification.category,
        suggestedAmount: extractedData.totalAmount || null,
        suggestedDate: extractedData.dates[0]?.date.toISOString().split('T')[0] || null,
        warnings: [],
        recommendations: ['Bitte überprüfen Sie die extrahierten Daten manuell']
      };
    }
  }

  /**
   * Get a human-readable analysis report
   */
  generateReport(analysis: DocumentAnalysis): string {
    const { aiAnalysis, classification, extractedData, ocrQuality } = analysis;

    let report = `# Beleganalyse: ${analysis.filename}\n\n`;

    // Summary
    report += `## Zusammenfassung\n${aiAnalysis.summary}\n\n`;

    // Classification
    report += `## Klassifizierung\n`;
    report += `- **Kategorie:** ${classification.category}\n`;
    report += `- **Konfidenz:** ${Math.round(classification.confidence * 100)}%\n`;
    report += `- **Begründung:** ${classification.reasoning}\n\n`;

    // Extracted Data
    report += `## Extrahierte Daten\n`;
    report += `- **Firma:** ${extractedData.vendor || 'Nicht erkannt'}\n`;
    report += `- **Betrag:** ${aiAnalysis.suggestedAmount ? `€${aiAnalysis.suggestedAmount}` : 'Nicht erkannt'}\n`;
    report += `- **Datum:** ${aiAnalysis.suggestedDate || 'Nicht erkannt'}\n`;
    report += `- **Rechnungsnummer:** ${extractedData.invoiceNumber || 'Nicht erkannt'}\n\n`;

    // Tax Relevance
    const relevanceEmoji = {
      high: '🟢',
      medium: '🟡',
      low: '🟠',
      none: '🔴'
    };
    report += `## Steuerliche Relevanz: ${relevanceEmoji[aiAnalysis.taxRelevance]} ${aiAnalysis.taxRelevance.toUpperCase()}\n\n`;

    // Key Findings
    if (aiAnalysis.keyFindings.length > 0) {
      report += `## Wichtige Erkenntnisse\n`;
      aiAnalysis.keyFindings.forEach((finding) => {
        report += `- ${finding}\n`;
      });
      report += '\n';
    }

    // Warnings
    if (aiAnalysis.warnings.length > 0) {
      report += `## ⚠️ Warnungen\n`;
      aiAnalysis.warnings.forEach((warning) => {
        report += `- ${warning}\n`;
      });
      report += '\n';
    }

    // OCR Quality
    report += `## OCR-Qualität: ${ocrQuality.score}%\n`;
    if (ocrQuality.issues.length > 0) {
      report += `**Probleme:**\n`;
      ocrQuality.issues.forEach((issue) => {
        report += `- ${issue}\n`;
      });
    }
    if (ocrQuality.recommendations.length > 0) {
      report += `**Empfehlungen:**\n`;
      ocrQuality.recommendations.forEach((rec) => {
        report += `- ${rec}\n`;
      });
    }
    report += '\n';

    // Recommendations
    if (aiAnalysis.recommendations.length > 0) {
      report += `## 💡 Empfehlungen\n`;
      aiAnalysis.recommendations.forEach((rec) => {
        report += `- ${rec}\n`;
      });
    }

    // Metadata
    report += `\n---\n`;
    report += `*Verarbeitet am: ${new Date(analysis.processedAt).toLocaleString('de-AT')}*\n`;
    report += `*Verarbeitungszeit: ${analysis.processingTime}ms*\n`;

    return report;
  }

  /**
   * Terminate the agent
   */
  async terminate(): Promise<void> {
    await ocrService.terminate();
    this.initialized = false;
  }
}

// Singleton instance
export const documentInspectorAgent = new DocumentInspectorAgent();
export default DocumentInspectorAgent;
