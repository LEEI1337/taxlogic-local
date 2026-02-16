import { z } from 'zod';

export const taxYearSchema = z.number().int().min(2020).max(2100);
export const idSchema = z.string().trim().min(1).max(200);
export const textInputSchema = z.string().trim().min(1).max(10000);

export const llmModelSchema = z.string().trim().min(1).max(200);

export const llmConfigSchema = z.object({
  provider: z.enum(['ollama', 'lmStudio', 'claude', 'openai', 'gemini', 'openaiCompatible']).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  ollamaModel: z.string().trim().min(1).max(200).optional(),
  lmStudioUrl: z.string().url().optional(),
  lmStudioModel: z.string().trim().min(1).max(200).optional(),
  anthropicApiKey: z.string().trim().min(1).max(500).optional(),
  anthropicModel: z.string().trim().min(1).max(200).optional(),
  openaiApiKey: z.string().trim().min(1).max(500).optional(),
  openaiModel: z.string().trim().min(1).max(200).optional(),
  openaiBaseUrl: z.string().url().optional(),
  geminiApiKey: z.string().trim().min(1).max(500).optional(),
  geminiModel: z.string().trim().min(1).max(200).optional(),
  openaiCompatibleUrl: z.string().url().optional(),
  openaiCompatibleApiKey: z.string().trim().min(1).max(500).optional(),
  openaiCompatibleModel: z.string().trim().min(1).max(200).optional()
}).strict();

export const llmQueryHistorySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(10000)
});

export const llmQuerySchema = z.object({
  prompt: z.string().trim().min(1).max(20000),
  conversationHistory: z.array(llmQueryHistorySchema).max(100).optional()
});

export const interviewStartSchema = z.object({
  userProfile: z.record(z.unknown()).default({}),
  taxYear: taxYearSchema.optional()
});

export const interviewSaveSchema = z.record(z.unknown());

export const documentUploadSchema = z.array(z.string().trim().min(1)).min(1).max(200);

export const formTypeSchema = z.enum(['L1', 'L1ab', 'L1k', 'all']);

export const outputPathSchema = z.string().trim().min(1).max(4096);
export const filePathSchema = z.string().trim().min(1).max(4096);

export const saveFileRequestSchema = z.object({
  defaultName: z.string().trim().min(1).max(255),
  filters: z.array(
    z.object({
      name: z.string().trim().min(1).max(80),
      extensions: z.array(z.string().trim().min(1).max(20)).max(20)
    }).strict()
  ).max(20).optional()
});

export const selectFilesFiltersSchema = z.array(
  z.object({
    name: z.string().trim().min(1).max(80),
    extensions: z.array(z.string().trim().min(1).max(20)).max(20)
  }).strict()
).max(20);

export const settingKeySchema = z.string().trim().min(1).max(120);

export const apiKeyNameSchema = z.enum([
  'anthropicApiKey',
  'openaiApiKey',
  'geminiApiKey',
  'openaiCompatibleApiKey'
]);

export const apiKeyValueSchema = z.string().max(5000);

export const ragQuerySchema = z.object({
  question: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(100).optional(),
  taxYear: taxYearSchema.optional()
});
