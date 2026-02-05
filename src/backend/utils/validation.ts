/**
 * TaxLogic.local - Input Validation
 *
 * Comprehensive input validation using Zod for type safety and data integrity
 */

import { z } from 'zod';

// ========================================
// User Profile Validation
// ========================================

export const userProfileSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().optional().or(z.literal('')),
  firstName: z.string().min(1, 'Vorname erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname erforderlich').max(100),
  taxId: z.string().regex(/^\d{9}$/, 'Steuer-ID muss 9 Ziffern enthalten').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().regex(/^\d{4}$/, 'PLZ muss 4 Ziffern enthalten').optional().or(z.literal('')),
  profession: z.string().max(200).optional(),
  employmentStatus: z.enum(['employee', 'freelancer', 'business_owner', 'retired', 'other']).optional(),
  annualIncome: z.number().min(0).max(10000000).optional(),
  taxYear: z.number().int().min(2020).max(2030).optional()
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

// ========================================
// Tax Interview Validation
// ========================================

export const taxInterviewResponseSchema = z.object({
  fullName: z.string().min(1).max(200),
  taxYear: z.number().int().min(2020).max(2030),
  employmentType: z.string().min(1).max(100),
  employerCount: z.number().int().min(0).max(10),
  grossIncome: z.number().min(0).max(10000000),
  commuteDistance: z.number().min(0).max(500).optional(),
  publicTransportFeasible: z.boolean().optional(),
  homeOfficeDays: z.number().int().min(0).max(365).optional(),
  workEquipmentCosts: z.number().min(0).max(100000).optional(),
  educationCosts: z.number().min(0).max(100000).optional(),
  medicalExpenses: z.number().min(0).max(100000).optional(),
  churchTax: z.number().min(0).max(1000).optional(),
  donations: z.number().min(0).max(100000).optional(),
  hasChildren: z.boolean().optional(),
  childrenCount: z.number().int().min(0).max(20).optional(),
  isSingleParent: z.boolean().optional()
});

export type TaxInterviewResponse = z.infer<typeof taxInterviewResponseSchema>;

// ========================================
// Document Upload Validation
// ========================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export const fileUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().max(MAX_FILE_SIZE, `Datei darf maximal ${MAX_FILE_SIZE / 1024 / 1024}MB groß sein`),
  type: z.string().refine(
    (type) => ALLOWED_FILE_TYPES.includes(type),
    'Nur PDF, JPG, JPEG und PNG Dateien erlaubt'
  ),
  path: z.string().min(1)
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

// ========================================
// Document Metadata Validation
// ========================================

export const documentMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  category: z.enum([
    'Werbungskosten',
    'Reisekosten',
    'Home Office',
    'Fortbildung',
    'Medizin',
    'Kirchenbeitrag',
    'Spenden',
    'Sonstige'
  ]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss Format YYYY-MM-DD haben').optional(),
  amount: z.number().min(0).max(1000000).optional(),
  vendor: z.string().max(200).optional(),
  description: z.string().max(1000).optional()
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

// ========================================
// Form Data Validation
// ========================================

export const l1FormDataSchema = z.object({
  taxYear: z.number().int().min(2020).max(2030),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  taxId: z.string().regex(/^\d{9}$/),
  grossIncome: z.number().min(0).max(10000000),
  deductions: z.number().min(0).max(1000000),
  taxableIncome: z.number().min(0).max(10000000),
  calculatedTax: z.number().min(0).max(10000000),
  withheldTax: z.number().min(0).max(10000000).optional(),
  refundAmount: z.number().optional()
});

export type L1FormData = z.infer<typeof l1FormDataSchema>;

// ========================================
// LLM Configuration Validation
// ========================================

export const llmConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmStudio', 'claude', 'openai', 'gemini', 'openaiCompatible']),
  model: z.string().min(1).max(100),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).max(500).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100000).optional()
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

// ========================================
// API Key Validation
// ========================================

export const apiKeySchema = z.object({
  anthropicApiKey: z.string().regex(/^sk-ant-/, 'Ungültiger Claude API Key').optional().or(z.literal('')),
  openaiApiKey: z.string().regex(/^sk-/, 'Ungültiger OpenAI API Key').optional().or(z.literal('')),
  geminiApiKey: z.string().min(20).max(100).optional().or(z.literal(''))
});

export type APIKeys = z.infer<typeof apiKeySchema>;

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validates input against a Zod schema and returns typed result
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Validates file upload and returns validation result
 */
export function validateFile(file: { name: string; size: number; type: string; path: string }): {
  valid: boolean;
  errors: string[];
} {
  const result = fileUploadSchema.safeParse(file);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((err) => err.message)
  };
}

/**
 * Validates multiple files
 */
export function validateFiles(files: Array<{ name: string; size: number; type: string; path: string }>): {
  valid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};
  let hasErrors = false;

  files.forEach((file, index) => {
    const result = validateFile(file);
    if (!result.valid) {
      errors[`file_${index}_${file.name}`] = result.errors;
      hasErrors = true;
    }
  });

  return { valid: !hasErrors, errors };
}

/**
 * Sanitizes string input by removing dangerous characters
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Validates and sanitizes user input
 */
export function sanitizeUserInput(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return sanitizeString(input);
}

/**
 * Validates Austrian postal code
 */
export function isValidAustrianPostalCode(postalCode: string): boolean {
  return /^\d{4}$/.test(postalCode) && parseInt(postalCode) >= 1000 && parseInt(postalCode) <= 9999;
}

/**
 * Validates Austrian tax ID (Steuernummer)
 */
export function isValidAustrianTaxId(taxId: string): boolean {
  return /^\d{9}$/.test(taxId);
}

/**
 * Validates email address
 */
export function isValidEmail(email: string): boolean {
  const emailSchema = z.string().email();
  return emailSchema.safeParse(email).success;
}

/**
 * Validates date in YYYY-MM-DD format
 */
export function isValidDate(date: string): boolean {
  const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (!dateSchema.safeParse(date).success) {
    return false;
  }
  const parsed = new Date(date);
  return parsed instanceof Date && !isNaN(parsed.getTime());
}
