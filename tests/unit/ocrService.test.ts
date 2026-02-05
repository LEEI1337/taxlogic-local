/**
 * Unit tests for OCRService
 *
 * Tests the OCR service functionality including:
 * - Structured data extraction
 * - Amount extraction
 * - Date extraction
 * - Currency detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import OCRService, { OCRResult } from '../../src/backend/services/ocrService';

// We don't test the actual OCR processing since it requires Tesseract
// Instead, we test the data extraction functions
describe('OCRService', () => {
  let service: OCRService;

  beforeEach(() => {
    service = new OCRService();
  });

  describe('extractStructuredData', () => {
    it('should extract amounts in Euro format', () => {
      const mockOCR: OCRResult = {
        text: 'Summe: 123,45 EUR\nMwSt: 20,69 €',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.amounts.length).toBeGreaterThan(0);
      expect(result.currency).toBe('EUR');
    });

    it('should extract dates in European format', () => {
      const mockOCR: OCRResult = {
        text: 'Rechnungsdatum: 15.03.2024\nFällig: 01/04/2024',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.dates.length).toBeGreaterThan(0);
      expect(result.dates[0].date).toBeInstanceOf(Date);
    });

    it('should detect vendor from text', () => {
      const mockOCR: OCRResult = {
        text: 'MediaMarkt GmbH\nMustergasse 1\n1010 Wien',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.vendor).toContain('GmbH');
    });

    it('should extract invoice number', () => {
      const mockOCR: OCRResult = {
        text: 'Rechnung Nr. RE-2024-001234\nDatum: 15.03.2024',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.invoiceNumber).toBeDefined();
    });

    it('should extract total amount', () => {
      const mockOCR: OCRResult = {
        text: 'Netto: 100,00\nMwSt: 20,00\nSumme: 120,00',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.totalAmount).toBe(120);
    });

    it('should extract tax amount', () => {
      const mockOCR: OCRResult = {
        text: 'Netto: 100,00\n20% MwSt: 20,00\nBrutto: 120,00',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);

      expect(result.taxAmount).toBe(20);
    });
  });

  describe('currency detection', () => {
    it('should detect EUR from € symbol', () => {
      const mockOCR: OCRResult = {
        text: 'Preis: € 50,00',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      expect(result.currency).toBe('EUR');
    });

    it('should detect EUR from text', () => {
      const mockOCR: OCRResult = {
        text: 'Total: 50,00 Euro',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      expect(result.currency).toBe('EUR');
    });

    it('should detect USD', () => {
      const mockOCR: OCRResult = {
        text: 'Total: $50.00 USD',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      expect(result.currency).toBe('USD');
    });

    it('should detect CHF', () => {
      const mockOCR: OCRResult = {
        text: 'Betrag: CHF 100.00',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      expect(result.currency).toBe('CHF');
    });

    it('should default to EUR for Austrian app', () => {
      const mockOCR: OCRResult = {
        text: 'Summe: 100,00',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      expect(result.currency).toBe('EUR');
    });
  });

  describe('date extraction', () => {
    it('should parse DD.MM.YYYY format', () => {
      const mockOCR: OCRResult = {
        text: 'Datum: 15.03.2024',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.dates.length).toBe(1);
      expect(result.dates[0].date.getDate()).toBe(15);
      expect(result.dates[0].date.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(result.dates[0].date.getFullYear()).toBe(2024);
    });

    it('should parse DD/MM/YYYY format', () => {
      const mockOCR: OCRResult = {
        text: 'Date: 20/12/2023',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.dates.length).toBe(1);
      expect(result.dates[0].date.getDate()).toBe(20);
      expect(result.dates[0].date.getMonth()).toBe(11); // December = 11
    });

    it('should parse DD-MM-YY format with century inference', () => {
      const mockOCR: OCRResult = {
        text: 'Date: 01-06-24',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.dates.length).toBe(1);
      expect(result.dates[0].date.getFullYear()).toBe(2024);
    });

    it('should extract multiple dates', () => {
      const mockOCR: OCRResult = {
        text: 'Rechnungsdatum: 15.03.2024\nLieferdatum: 18.03.2024\nFälligkeit: 30.03.2024',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.dates.length).toBe(3);
    });
  });

  describe('amount extraction', () => {
    it('should extract Euro amounts with comma as decimal separator', () => {
      const mockOCR: OCRResult = {
        text: 'Betrag: 1.234,56 EUR',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.amounts.length).toBeGreaterThan(0);
      const euroAmount = result.amounts.find(a => a.currency === 'EUR');
      expect(euroAmount?.value).toBe(1234.56);
    });

    it('should extract multiple amounts', () => {
      const mockOCR: OCRResult = {
        text: 'Artikel 1: 50,00 EUR\nArtikel 2: 75,50 EUR\nGesamt: 125,50 EUR',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.amounts.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle amounts without currency symbol', () => {
      const mockOCR: OCRResult = {
        text: 'Summe: 99,99',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      // Should still default to EUR for Austrian context
      expect(result.currency).toBe('EUR');
    });
  });

  describe('vendor extraction', () => {
    it('should extract company with GmbH suffix', () => {
      const mockOCR: OCRResult = {
        text: 'BILLA AG\nFiliale Wien Mitte\nRechnung',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.vendor).toContain('AG');
    });

    it('should extract company with KG suffix', () => {
      const mockOCR: OCRResult = {
        text: 'Mustermann & Co KG\nMusterstraße 1',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.vendor).toContain('KG');
    });

    it('should use first line as fallback', () => {
      const mockOCR: OCRResult = {
        text: 'Shop Name\nAdresse\n',
        confidence: 95,
        lines: [],
        words: [],
        processingTime: 100
      };

      const result = service.extractStructuredData(mockOCR);
      
      expect(result.vendor).toBe('Shop Name');
    });
  });

  describe('service status', () => {
    it('should report not ready before initialization', () => {
      const newService = new OCRService();
      expect(newService.isReady()).toBe(false);
    });
  });
});
