/**
 * Unit tests for InterviewerAgent
 *
 * Tests the tax interview system including:
 * - Interview initialization
 * - Response validation
 * - Question flow and skipping
 * - Response parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterviewerAgent, TAX_INTERVIEW_QUESTIONS } from '../../src/backend/agents/interviewerAgent';

// Mock the LLM service
vi.mock('../../src/backend/services/llmService', () => ({
  llmService: {
    query: vi.fn().mockResolvedValue({
      content: 'Verstanden! Nächste Frage...',
      provider: 'ollama',
      model: 'mistral'
    })
  }
}));

describe('InterviewerAgent', () => {
  let agent: InterviewerAgent;

  beforeEach(() => {
    agent = new InterviewerAgent();
    vi.clearAllMocks();
  });

  describe('startInterview', () => {
    it('should start an interview with greeting question', () => {
      const result = agent.startInterview('user-123', 2024);

      expect(result.isComplete).toBe(false);
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion?.id).toBe('greeting');
      expect(result.message).toContain('Willkommen');
    });

    it('should initialize context correctly', () => {
      agent.startInterview('user-456', 2023);
      const context = agent.getContext();

      expect(context).not.toBeNull();
      expect(context?.userId).toBe('user-456');
      expect(context?.taxYear).toBe(2023);
      expect(context?.currentQuestionId).toBe('greeting');
      expect(context?.responses).toEqual({});
    });
  });

  describe('processResponse', () => {
    beforeEach(() => {
      agent.startInterview('user-123', 2024);
    });

    it('should validate required responses', async () => {
      const result = await agent.processResponse('');

      expect(result.validationError).toBeDefined();
      expect(result.validationError).toContain('erforderlich');
    });

    it('should accept valid text response', async () => {
      const result = await agent.processResponse('Max Mustermann');

      expect(result.validationError).toBeUndefined();
      expect(result.isComplete).toBe(false);
      expect(result.nextQuestion).toBeDefined();
    });

    it('should store response in context', async () => {
      await agent.processResponse('Max Mustermann');
      const responses = agent.getResponses();

      expect(responses.greeting).toBe('Max Mustermann');
    });
  });

  describe('validateResponse', () => {
    beforeEach(() => {
      agent.startInterview('user-123', 2024);
    });

    it('should validate number in range', async () => {
      // Skip to tax year question
      await agent.processResponse('Max Mustermann');
      
      // Test invalid year
      const result = await agent.processResponse('2015');
      expect(result.validationError).toBeDefined();
    });

    it('should validate choice options', async () => {
      // Skip to employment type question
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');

      // Test invalid choice
      const result = await agent.processResponse('ungültige Option');
      expect(result.validationError).toBeDefined();
      expect(result.validationError).toContain('Optionen');
    });
  });

  describe('parseResponse', () => {
    beforeEach(() => {
      agent.startInterview('user-123', 2024);
    });

    it('should parse boolean responses correctly', async () => {
      // Navigate to commute_exists question (boolean type)
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('1'); // employer count
      await agent.processResponse('45000'); // gross income

      // Now at commute_exists
      await agent.processResponse('ja');
      const responses = agent.getResponses();

      expect(responses.commute_exists).toBe(true);
    });

    it('should parse number responses correctly', async () => {
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('2');

      const responses = agent.getResponses();
      expect(responses.employer_count).toBe(2);
    });

    it('should parse European formatted numbers for gross income correctly', async () => {
      // Navigate to gross_income question
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('1'); // employer_count

      // European format with thousands separator dot and decimal comma
      await agent.processResponse('1.234,56'); // gross income

      const responses = agent.getResponses();
      expect(responses.gross_income).toBeCloseTo(1234.56, 2);
    });

    it('should parse European formatted numbers with spaces correctly', async () => {
      // Navigate to gross_income question
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('1'); // employer_count

      // European format with space as thousands separator and decimal comma
      await agent.processResponse('1 234,56'); // gross income

      const responses = agent.getResponses();
      expect(responses.gross_income).toBeCloseTo(1234.56, 2);
    });
  });

  describe('question skipping', () => {
    beforeEach(() => {
      agent.startInterview('user-123', 2024);
    });

    it('should skip commute questions when commute_exists is false', async () => {
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('1');
      await agent.processResponse('45000');
      const nextQuestion = await agent.processResponse('nein'); // No commute

      // Next question should not be any of the commute-related questions
      expect(nextQuestion?.id).not.toBe('commute_distance');
      expect(nextQuestion?.id).not.toBe('commute_transport');
      expect(nextQuestion?.id).not.toBe('commute_public_feasible');
    });

    it('should skip work_equipment_details when work_equipment is false', async () => {
      await agent.processResponse('Max Mustermann');
      await agent.processResponse('2024');
      await agent.processResponse('Vollzeit angestellt');
      await agent.processResponse('1');
      await agent.processResponse('45000');
      await agent.processResponse('nein'); // No commute
      await agent.processResponse('50'); // home office days
      await agent.processResponse('nein'); // No work equipment

      const context = agent.getContext();
      expect(context?.currentQuestionId).not.toBe('work_equipment_details');
    });
  });

  describe('context management', () => {
    it('should restore context correctly', () => {
      const savedContext = {
        userId: 'user-saved',
        taxYear: 2023,
        currentQuestionId: 'gross_income',
        responses: { greeting: 'Test User', tax_year_confirm: 2023 },
        conversationHistory: [],
        validationErrors: []
      };

      agent.restoreContext(savedContext);
      const context = agent.getContext();

      expect(context?.userId).toBe('user-saved');
      expect(context?.taxYear).toBe(2023);
      expect(context?.responses.greeting).toBe('Test User');
    });
  });

  describe('TAX_INTERVIEW_QUESTIONS', () => {
    it('should have all required questions defined', () => {
      const requiredQuestionIds = [
        'greeting',
        'tax_year_confirm',
        'employment_type',
        'employer_count',
        'gross_income',
        'commute_exists',
        'home_office_days',
        'work_equipment',
        'education_expenses',
        'church_tax',
        'donations',
        'medical_expenses',
        'has_children',
        'single_earner'
      ];

      const questionIds = TAX_INTERVIEW_QUESTIONS.map(q => q.id);

      requiredQuestionIds.forEach(id => {
        expect(questionIds).toContain(id);
      });
    });

    it('should have valid question types', () => {
      const validTypes = ['text', 'number', 'choice', 'date', 'boolean'];

      TAX_INTERVIEW_QUESTIONS.forEach(q => {
        expect(validTypes).toContain(q.type);
      });
    });

    it('should have options defined for choice questions', () => {
      const choiceQuestions = TAX_INTERVIEW_QUESTIONS.filter(q => q.type === 'choice');

      choiceQuestions.forEach(q => {
        expect(q.options).toBeDefined();
        expect(q.options!.length).toBeGreaterThan(0);
      });
    });
  });
});
