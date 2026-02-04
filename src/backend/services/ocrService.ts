/**
 * TaxLogic.local - OCR Service
 *
 * Tesseract.js-based OCR processing for:
 * - Receipt scanning
 * - Invoice processing
 * - Document text extraction
 * - Structured data extraction (amounts, dates, vendors)
 */

import { Worker, createWorker, RecognizeResult } from 'tesseract.js';
import * as fs from 'fs';

// ========================================
// Type Definitions
// ========================================

export interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLine[];
  words: OCRWord[];
  processingTime: number;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ExtractedData {
  amounts: ExtractedAmount[];
  dates: ExtractedDate[];
  vendor?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  taxAmount?: number;
  currency: string;
}

export interface ExtractedAmount {
  value: number;
  currency: string;
  raw: string;
  confidence: number;
}

export interface ExtractedDate {
  date: Date;
  raw: string;
  confidence: number;
}

// ========================================
// OCR Service Class
// ========================================

class OCRService {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private language: string = 'deu+eng'; // German + English

  /**
   * Initialize the OCR worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[OCR] Initializing Tesseract worker...');

    this.worker = await createWorker(this.language, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    this.isInitialized = true;
    console.log('[OCR] Tesseract worker initialized');
  }

  /**
   * Set OCR language
   */
  async setLanguage(lang: string): Promise<void> {
    this.language = lang;
    if (this.worker) {
      await this.terminate();
      await this.initialize();
    }
  }

  /**
   * Process an image file and extract text
   */
  async processImage(imagePath: string): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    // Verify file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    console.log(`[OCR] Processing image: ${imagePath}`);
    const startTime = Date.now();

    const result: RecognizeResult = await this.worker.recognize(imagePath);
    const processingTime = Date.now() - startTime;

    console.log(`[OCR] Processing completed in ${processingTime}ms`);

    return this.formatResult(result, processingTime);
  }

  /**
   * Process a buffer (e.g., from file upload)
   */
  async processBuffer(buffer: Buffer, mimeType: string = 'image/png'): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    console.log(`[OCR] Processing buffer (${buffer.length} bytes)`);
    const startTime = Date.now();

    // Create a data URL from the buffer
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const result: RecognizeResult = await this.worker.recognize(dataUrl);
    const processingTime = Date.now() - startTime;

    console.log(`[OCR] Processing completed in ${processingTime}ms`);

    return this.formatResult(result, processingTime);
  }

  /**
   * Process a PDF file (first page only for now)
   */
  async processPDF(_pdfPath: string): Promise<OCRResult> {
    // For PDF processing, we'd need to convert to images first
    // Using pdf-parse for text-based PDFs, Tesseract for scanned PDFs
    // This is a simplified implementation
    throw new Error('PDF OCR not yet implemented - use image files');
  }

  /**
   * Extract structured data from OCR text
   */
  extractStructuredData(ocrResult: OCRResult): ExtractedData {
    const text = ocrResult.text;

    return {
      amounts: this.extractAmounts(text),
      dates: this.extractDates(text),
      vendor: this.extractVendor(text),
      invoiceNumber: this.extractInvoiceNumber(text),
      totalAmount: this.extractTotalAmount(text),
      taxAmount: this.extractTaxAmount(text),
      currency: this.detectCurrency(text)
    };
  }

  /**
   * Extract monetary amounts from text
   */
  private extractAmounts(text: string): ExtractedAmount[] {
    const amounts: ExtractedAmount[] = [];

    // European format: 1.234,56 EUR or 1234,56 EUR
    const euroPattern = /(\d{1,3}(?:\.\d{3})*(?:,\d{2}))\s*(?:EUR|Euro|€)?/gi;

    // US format: 1,234.56 USD or $1234.56
    const usdPattern = /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*(?:USD)?/gi;

    let match;

    // Extract Euro amounts
    while ((match = euroPattern.exec(text)) !== null) {
      const raw = match[0];
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const value = parseFloat(numStr);

      if (!isNaN(value) && value > 0) {
        amounts.push({
          value,
          currency: 'EUR',
          raw,
          confidence: 0.8
        });
      }
    }

    // Extract USD amounts
    while ((match = usdPattern.exec(text)) !== null) {
      const raw = match[0];
      const numStr = match[1].replace(/,/g, '');
      const value = parseFloat(numStr);

      if (!isNaN(value) && value > 0) {
        amounts.push({
          value,
          currency: 'USD',
          raw,
          confidence: 0.8
        });
      }
    }

    return amounts;
  }

  /**
   * Extract dates from text
   */
  private extractDates(text: string): ExtractedDate[] {
    const dates: ExtractedDate[] = [];

    // European date formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const euDatePattern = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/g;

    // ISO format: YYYY-MM-DD
    const isoDatePattern = /(\d{4})-(\d{2})-(\d{2})/g;

    let match;

    // Extract European dates
    while ((match = euDatePattern.exec(text)) !== null) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Handle 2-digit years
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          dates.push({
            date,
            raw: match[0],
            confidence: 0.85
          });
        }
      }
    }

    // Extract ISO dates
    while ((match = isoDatePattern.exec(text)) !== null) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);

      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        dates.push({
          date,
          raw: match[0],
          confidence: 0.95
        });
      }
    }

    return dates;
  }

  /**
   * Extract vendor/company name
   */
  private extractVendor(text: string): string | undefined {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    // Usually the vendor is in the first few lines
    // Look for company indicators
    const companyIndicators = ['GmbH', 'AG', 'KG', 'OG', 'e.U.', 'GesmbH', 'Co.', 'Inc.', 'Ltd.'];

    for (const line of lines.slice(0, 10)) {
      for (const indicator of companyIndicators) {
        if (line.includes(indicator)) {
          return line.trim();
        }
      }
    }

    // Return first non-empty line as fallback
    return lines[0]?.trim();
  }

  /**
   * Extract invoice/receipt number
   */
  private extractInvoiceNumber(text: string): string | undefined {
    // Look for patterns like "Rechnung Nr.", "Beleg Nr.", "Invoice #"
    const patterns = [
      /(?:Rechnung|Beleg|Invoice|Receipt|Nummer|Nr\.?|#)\s*:?\s*([A-Z0-9-]+)/i,
      /(?:RE|RG|INV)[- ]?(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract total amount
   */
  private extractTotalAmount(text: string): number | undefined {
    // Look for total indicators
    const totalPatterns = [
      /(?:Gesamt|Total|Summe|Endbetrag|Zu zahlen)[:\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      /(?:Brutto|Gross)[:\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(numStr);
        if (!isNaN(value)) {
          return value;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract tax/VAT amount
   */
  private extractTaxAmount(text: string): number | undefined {
    // Look for tax indicators
    const taxPatterns = [
      /(?:MwSt|USt|VAT|Steuer|Mehrwertsteuer)[:\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      /(\d{1,2})\s*%\s*(?:MwSt|USt|VAT)/i
    ];

    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1].replace(/\./g, '').replace(',', '.');
        const value = parseFloat(numStr);
        if (!isNaN(value)) {
          return value;
        }
      }
    }

    return undefined;
  }

  /**
   * Detect currency from text
   */
  private detectCurrency(text: string): string {
    if (text.includes('€') || text.includes('EUR') || text.includes('Euro')) {
      return 'EUR';
    }
    if (text.includes('$') || text.includes('USD')) {
      return 'USD';
    }
    if (text.includes('CHF') || text.includes('Fr.')) {
      return 'CHF';
    }
    if (text.includes('£') || text.includes('GBP')) {
      return 'GBP';
    }
    // Default for Austrian tax app
    return 'EUR';
  }

  /**
   * Format Tesseract result to our OCRResult interface
   */
  private formatResult(result: RecognizeResult, processingTime: number): OCRResult {
    const lines: OCRLine[] = result.data.lines?.map((line) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1
      }
    })) || [];

    const words: OCRWord[] = result.data.words?.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      }
    })) || [];

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      lines,
      words,
      processingTime
    };
  }

  /**
   * Terminate the OCR worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('[OCR] Worker terminated');
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }
}

// Singleton instance
export const ocrService = new OCRService();
export default OCRService;
