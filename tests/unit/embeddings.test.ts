/**
 * Unit tests for EmbeddingsService
 *
 * Tests the embeddings functionality including:
 * - Embedding generation
 * - Batch processing
 * - Cosine similarity calculation
 * - Cache management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingsService } from '../../src/backend/rag/embeddings';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeEach(() => {
    service = new EmbeddingsService();
    service.clearCache();
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available with embedding model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'nomic-embed-text:latest' },
            { name: 'mistral:latest' }
          ]
        })
      });

      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when no embedding model found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral:latest' }]
        })
      });

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await service.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('embed', () => {
    it('should generate embedding for text', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      });

      const result = await service.embed('Test text');

      expect(result.text).toBe('Test text');
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.dimensions).toBe(768);
    });

    it('should return cached embedding on second call', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      });

      // First call - should hit API
      await service.embed('Test text');
      
      // Second call - should use cache
      const result = await service.embed('Test text');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      await expect(service.embed('Test')).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('embedBatch', () => {
    it('should process multiple texts', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      });

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const result = await service.embedBatch(texts);

      expect(result.results).toHaveLength(3);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should use cache for duplicate texts in batch', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      });

      // First, embed a text to populate cache
      await service.embed('Same text');
      
      // Clear mock call count
      mockFetch.mockClear();
      
      // Now embed batch with the same text (should use cache)
      const texts = ['Same text', 'Same text', 'Same text'];
      await service.embedBatch(texts);

      // All texts are the same and should be cached, so no new API calls
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [0.1, 0.2, 0.3, 0.4];
      const similarity = service.cosineSimilarity(vector, vector);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      const similarity = service.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      const similarity = service.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should throw error for vectors of different dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => service.cosineSimilarity(a, b)).toThrow('same dimensions');
    });

    it('should return 0 for zero vectors', () => {
      const zero = [0, 0, 0];
      const other = [1, 2, 3];
      const similarity = service.cosineSimilarity(zero, other);

      expect(similarity).toBe(0);
    });
  });

  describe('findMostSimilar', () => {
    it('should return top K most similar candidates', () => {
      const queryEmbedding = [1, 0, 0];
      const candidates = [
        { id: '1', embedding: [1, 0, 0], text: 'Identical' },
        { id: '2', embedding: [0.9, 0.1, 0], text: 'Similar' },
        { id: '3', embedding: [0, 1, 0], text: 'Orthogonal' },
        { id: '4', embedding: [-1, 0, 0], text: 'Opposite' }
      ];

      const results = service.findMostSimilar(queryEmbedding, candidates, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[0].similarity).toBeCloseTo(1, 5);
      expect(results[1].id).toBe('2');
    });

    it('should return all candidates when topK exceeds count', () => {
      const queryEmbedding = [1, 0];
      const candidates = [
        { id: '1', embedding: [1, 0], text: 'A' },
        { id: '2', embedding: [0, 1], text: 'B' }
      ];

      const results = service.findMostSimilar(queryEmbedding, candidates, 10);

      expect(results).toHaveLength(2);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      const stats1 = service.getCacheStats();
      expect(stats1.size).toBe(0);

      // Add item to cache by embedding
      const mockEmbedding = Array(768).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding })
      });

      // Clear cache
      service.clearCache();
      const stats2 = service.getCacheStats();

      expect(stats2.size).toBe(0);
    });

    it('should return cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });
});
