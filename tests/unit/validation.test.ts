/**
 * TaxLogic.local - Validation Tests
 */

import { describe, it, expect } from 'vitest';

import {
  isValidAustrianTaxId,
  isValidAustrianPostalCode,
  isValidEmail,
  isValidDate,
  sanitizeString,
  sanitizeUserInput,
  validateFile,
  userProfileSchema,
  validateInput
} from '../../src/backend/utils/validation';

// ========================================
// Austrian Tax ID Validation
// ========================================

describe('isValidAustrianTaxId', () => {
  it('should reject non-9-digit strings', () => {
    expect(isValidAustrianTaxId('')).toBe(false);
    expect(isValidAustrianTaxId('12345678')).toBe(false); // 8 digits
    expect(isValidAustrianTaxId('1234567890')).toBe(false); // 10 digits
    expect(isValidAustrianTaxId('abcdefghi')).toBe(false);
  });

  it('should reject invalid Finanzamt codes', () => {
    expect(isValidAustrianTaxId('000000000')).toBe(false); // FA code 00
  });

  it('should validate check digit correctly', () => {
    // The check digit algorithm: weights [1,2,1,2,1,2,1,2], sum digits if product >= 10
    // Check digit = (10 - sum % 10) % 10
    // Valid example: manually construct one
    // FA 12, number 345678, check digit needs to be calculated
    // 1*1 + 2*2 + 3*1 + 4*2 + 5*1 + 6*2 + 7*1 + 8*2
    // = 1 + 4 + 3 + 8 + 5 + (12->1+2=3) + 7 + (16->1+6=7)
    // = 1 + 4 + 3 + 8 + 5 + 3 + 7 + 7 = 38
    // check = (10 - 38 % 10) % 10 = (10 - 8) % 10 = 2
    expect(isValidAustrianTaxId('123456782')).toBe(true);
    expect(isValidAustrianTaxId('123456783')).toBe(false); // wrong check digit
  });
});

// ========================================
// Austrian Postal Code Validation
// ========================================

describe('isValidAustrianPostalCode', () => {
  it('should accept valid Austrian postal codes', () => {
    expect(isValidAustrianPostalCode('1010')).toBe(true); // Wien 1. Bezirk
    expect(isValidAustrianPostalCode('5020')).toBe(true); // Salzburg
    expect(isValidAustrianPostalCode('8010')).toBe(true); // Graz
    expect(isValidAustrianPostalCode('9999')).toBe(true);
    expect(isValidAustrianPostalCode('1000')).toBe(true);
  });

  it('should reject invalid postal codes', () => {
    expect(isValidAustrianPostalCode('')).toBe(false);
    expect(isValidAustrianPostalCode('123')).toBe(false);
    expect(isValidAustrianPostalCode('12345')).toBe(false);
    expect(isValidAustrianPostalCode('abcd')).toBe(false);
    expect(isValidAustrianPostalCode('0999')).toBe(false);
  });
});

// ========================================
// Email Validation
// ========================================

describe('isValidEmail', () => {
  it('should accept valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.at')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@missing-local.com')).toBe(false);
  });
});

// ========================================
// Date Validation
// ========================================

describe('isValidDate', () => {
  it('should accept valid YYYY-MM-DD dates', () => {
    expect(isValidDate('2024-01-15')).toBe(true);
    expect(isValidDate('2023-12-31')).toBe(true);
  });

  it('should reject invalid date formats', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('15.01.2024')).toBe(false);
    expect(isValidDate('2024/01/15')).toBe(false);
    expect(isValidDate('not-a-date')).toBe(false);
  });
});

// ========================================
// String Sanitization
// ========================================

describe('sanitizeString', () => {
  it('should remove script tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>hello')).toBe('hello');
  });

  it('should remove HTML tags', () => {
    expect(sanitizeString('<b>bold</b>')).toBe('bold');
    expect(sanitizeString('<div class="test">content</div>')).toBe('content');
  });

  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should handle empty strings', () => {
    expect(sanitizeString('')).toBe('');
  });
});

describe('sanitizeUserInput', () => {
  it('should handle non-string input', () => {
    expect(sanitizeUserInput(123)).toBe('');
    expect(sanitizeUserInput(null)).toBe('');
    expect(sanitizeUserInput(undefined)).toBe('');
  });

  it('should sanitize string input', () => {
    expect(sanitizeUserInput('<b>test</b>')).toBe('test');
  });
});

// ========================================
// File Validation
// ========================================

describe('validateFile', () => {
  it('should accept valid file uploads', () => {
    const result = validateFile({
      name: 'receipt.pdf',
      size: 1024 * 1024, // 1MB
      type: 'application/pdf',
      path: '/tmp/receipt.pdf'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject files exceeding size limit', () => {
    const result = validateFile({
      name: 'huge.pdf',
      size: 20 * 1024 * 1024, // 20MB
      type: 'application/pdf',
      path: '/tmp/huge.pdf'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject unsupported file types', () => {
    const result = validateFile({
      name: 'script.exe',
      size: 1024,
      type: 'application/x-msdownload',
      path: '/tmp/script.exe'
    });
    expect(result.valid).toBe(false);
  });

  it('should accept image file types', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/jpg']) {
      const result = validateFile({
        name: `photo.${type.split('/')[1]}`,
        size: 1024,
        type,
        path: `/tmp/photo.${type.split('/')[1]}`
      });
      expect(result.valid).toBe(true);
    }
  });
});

// ========================================
// User Profile Schema
// ========================================

describe('userProfileSchema', () => {
  it('should validate a complete profile', () => {
    const result = validateInput(userProfileSchema, {
      firstName: 'Max',
      lastName: 'Mustermann',
      taxId: '123456782', // valid check digit
      postalCode: '1010',
      profession: 'Software Developer',
      employmentStatus: 'employee',
      annualIncome: 50000,
      taxYear: 2024
    });
    expect(result.success).toBe(true);
  });

  it('should reject names that are too short', () => {
    const result = validateInput(userProfileSchema, {
      firstName: '',
      lastName: 'M'
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid employment statuses', () => {
    for (const status of ['employee', 'freelancer', 'business_owner', 'retired', 'other']) {
      const result = validateInput(userProfileSchema, {
        firstName: 'Test',
        lastName: 'User',
        employmentStatus: status
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid employment statuses', () => {
    const result = validateInput(userProfileSchema, {
      firstName: 'Test',
      lastName: 'User',
      employmentStatus: 'invalid'
    });
    expect(result.success).toBe(false);
  });
});
