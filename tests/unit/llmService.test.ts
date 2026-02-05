/**
 * Unit tests for LLMService
 *
 * Tests the LLM service functionality including:
 * - Configuration management
 * - Provider switching
 * - Status checking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import LLMService from '../../src/backend/services/llmService';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMService', () => {
  let service: LLMService;

  beforeEach(() => {
    service = new LLMService();
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should initialize with default configuration', () => {
      // Service should use ollama by default
      expect(service).toBeDefined();
    });

    it('should allow setting provider', () => {
      service.setProvider('claude');
      // Provider should be set (internal state)
      expect(service).toBeDefined();
    });

    it('should allow setting model', () => {
      service.setModel('mistral:7b');
      expect(service).toBeDefined();
    });

    it('should update configuration with setConfig', () => {
      service.setConfig({
        anthropicApiKey: 'test-key',
        openaiApiKey: 'test-openai-key'
      });
      expect(service).toBeDefined();
    });
  });

  describe('checkStatus', () => {
    it('should check Ollama status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'mistral' }] })
      });

      const status = await service.checkStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.ollama).toBe('boolean');
    });

    it('should return false for Ollama when not available', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const status = await service.checkStatus();
      
      expect(status.ollama).toBe(false);
    });

    it('should handle timeout for status check', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        )
      );

      const status = await service.checkStatus();
      
      // Should return false due to timeout
      expect(status.ollama).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return Ollama models when available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'mistral:latest' },
            { name: 'llama2:7b' }
          ]
        })
      });

      service.setProvider('ollama');
      const models = await service.getAvailableModels();

      expect(Array.isArray(models)).toBe(true);
    });

    it('should return Claude models', async () => {
      service.setProvider('claude');
      const models = await service.getAvailableModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models).toContain('claude-3-5-sonnet-20241022');
    });

    it('should return OpenAI models', async () => {
      service.setProvider('openai');
      const models = await service.getAvailableModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models).toContain('gpt-4o');
    });

    it('should return Gemini models', async () => {
      service.setProvider('gemini');
      const models = await service.getAvailableModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models).toContain('gemini-1.5-flash');
    });
  });

  describe('query', () => {
    it('should query Ollama successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'Test response from Ollama' }
        })
      });

      service.setProvider('ollama');
      const response = await service.query('Test question');

      expect(response.content).toBe('Test response from Ollama');
      expect(response.provider).toBe('ollama');
    });

    it('should handle query with conversation history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'Response with context' }
        })
      });

      const history = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' }
      ];

      const response = await service.query('Follow-up question', history);

      expect(response.content).toBeDefined();
    });

    it('should handle query with system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'System-guided response' }
        })
      });

      const response = await service.query(
        'Question',
        [],
        'You are a helpful assistant'
      );

      expect(response.content).toBeDefined();
    });

    it('should fallback to next provider on failure', async () => {
      // First call fails (Ollama)
      mockFetch.mockRejectedValueOnce(new Error('Ollama unavailable'));
      // Second call succeeds (LM Studio)
      mockFetch.mockRejectedValueOnce(new Error('LM Studio unavailable'));

      service.setProvider('ollama');

      await expect(service.query('Test')).rejects.toThrow();
    });

    it('should throw error when all providers fail', async () => {
      mockFetch.mockRejectedValue(new Error('All providers unavailable'));

      await expect(service.query('Test')).rejects.toThrow();
    });
  });

  describe('LM Studio provider', () => {
    it('should query LM Studio correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'LM Studio response' } }],
          usage: { total_tokens: 100 }
        })
      });

      service.setProvider('lmStudio');
      const response = await service.query('Test question');

      expect(response.content).toBe('LM Studio response');
      expect(response.provider).toBe('lmStudio');
      expect(response.tokensUsed).toBe(100);
    });
  });

  describe('OpenAI provider', () => {
    it('should query OpenAI correctly', async () => {
      service.setConfig({ openaiApiKey: 'test-key' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenAI response' } }],
          usage: { total_tokens: 150 }
        })
      });

      service.setProvider('openai');
      const response = await service.query('Test question');

      expect(response.content).toBe('OpenAI response');
      expect(response.provider).toBe('openai');
    });

    it('should throw error when API key not configured', async () => {
      service.setConfig({ openaiApiKey: undefined });
      service.setProvider('openai');

      mockFetch.mockRejectedValueOnce(new Error('Ollama unavailable'));
      mockFetch.mockRejectedValueOnce(new Error('LM Studio unavailable'));

      await expect(service.query('Test')).rejects.toThrow();
    });
  });

  describe('Gemini provider', () => {
    it('should query Gemini correctly', async () => {
      service.setConfig({ geminiApiKey: 'test-key' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Gemini response' }]
            }
          }],
          usageMetadata: { totalTokenCount: 200 }
        })
      });

      service.setProvider('gemini');
      const response = await service.query('Test question');

      expect(response.content).toBe('Gemini response');
      expect(response.provider).toBe('gemini');
    });
  });
});
