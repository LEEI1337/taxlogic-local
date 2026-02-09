/**
 * TaxLogic.local - Database Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import DatabaseService from '../../src/backend/services/dbService';

// Use a temporary directory for test databases
const TEST_DB_DIR = path.join(os.tmpdir(), 'taxlogic-test');

describe('DatabaseService', () => {
  let db: DatabaseService;
  let dbPath: string;

  beforeEach(async () => {
    // Create unique test db path
    dbPath = path.join(TEST_DB_DIR, `test-${Date.now()}.db`);
    db = new DatabaseService(dbPath);
    await db.initialize();
  });

  afterEach(() => {
    db.close();
    // Cleanup test db
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  // ========================================
  // User Operations
  // ========================================

  describe('User Operations', () => {
    it('should create a user with default profile', () => {
      const user = db.createUser();
      expect(user.id).toBeDefined();
      expect(user.profile_data).toEqual({});
      expect(user.created_at).toBeDefined();
    });

    it('should create a user with profile data', () => {
      const profile = { profession: 'Softwareentwickler', annual_income: 50000 };
      const user = db.createUser(profile);
      expect(user.profile_data).toEqual(profile);
    });

    it('should retrieve a user by ID', () => {
      const created = db.createUser({ profession: 'Lehrer' });
      const retrieved = db.getUser(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.profile_data.profession).toBe('Lehrer');
    });

    it('should return null for non-existent user', () => {
      const result = db.getUser('non-existent-id');
      expect(result).toBeNull();
    });

    it('should list all users', () => {
      db.createUser({ profession: 'User1' });
      db.createUser({ profession: 'User2' });
      const users = db.getAllUsers();
      expect(users).toHaveLength(2);
    });

    it('should update user profile', () => {
      const user = db.createUser({ profession: 'Old' });
      db.updateUser(user.id, { profession: 'New', annual_income: 60000 });
      const updated = db.getUser(user.id);
      expect(updated!.profile_data.profession).toBe('New');
      expect(updated!.profile_data.annual_income).toBe(60000);
    });

    it('should throw when updating non-existent user', () => {
      expect(() => db.updateUser('fake-id', { profession: 'X' })).toThrow();
    });
  });

  // ========================================
  // Interview Operations
  // ========================================

  describe('Interview Operations', () => {
    let userId: string;

    beforeEach(() => {
      userId = db.createUser().id;
    });

    it('should create an interview', () => {
      const interview = db.createInterview(userId, 2024);
      expect(interview.id).toBeDefined();
      expect(interview.user_id).toBe(userId);
      expect(interview.tax_year).toBe(2024);
      expect(interview.status).toBe('draft');
      expect(interview.responses).toEqual({});
    });

    it('should retrieve an interview by ID', () => {
      const created = db.createInterview(userId, 2024);
      const retrieved = db.getInterview(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.tax_year).toBe(2024);
    });

    it('should list interviews by user', () => {
      db.createInterview(userId, 2024);
      db.createInterview(userId, 2023);
      const interviews = db.getInterviewsByUser(userId);
      expect(interviews).toHaveLength(2);
    });

    it('should update interview responses', () => {
      const interview = db.createInterview(userId, 2024);
      const responses = { gross_income: 45000, profession: 'Entwickler' };
      db.updateInterviewResponses(interview.id, responses);

      const updated = db.getInterview(interview.id);
      expect(updated!.responses).toEqual(responses);
    });

    it('should update interview status', () => {
      const interview = db.createInterview(userId, 2024);
      db.updateInterviewStatus(interview.id, 'completed');

      const updated = db.getInterview(interview.id);
      expect(updated!.status).toBe('completed');
    });
  });

  // ========================================
  // Document Operations
  // ========================================

  describe('Document Operations', () => {
    let userId: string;

    beforeEach(() => {
      userId = db.createUser().id;
    });

    it('should create a document', () => {
      const doc = db.createDocument(userId, {
        original_filename: 'receipt.jpg',
        stored_path: '/data/documents/receipt.jpg',
        category: 'Werbungskosten',
        extracted_data: { amount: 150 },
        ocr_confidence: 0.85
      });
      expect(doc.id).toBeDefined();
      expect(doc.original_filename).toBe('receipt.jpg');
    });

    it('should retrieve documents by user', () => {
      db.createDocument(userId, {
        original_filename: 'file1.jpg',
        stored_path: '/path1',
        category: 'Werbungskosten',
        extracted_data: {},
        ocr_confidence: 0.9
      });
      db.createDocument(userId, {
        original_filename: 'file2.pdf',
        stored_path: '/path2',
        category: 'Sonderausgaben',
        extracted_data: {},
        ocr_confidence: 0.8
      });

      const docs = db.getDocumentsByUser(userId);
      expect(docs).toHaveLength(2);
    });

    it('should filter documents by category', () => {
      db.createDocument(userId, {
        original_filename: 'a.jpg',
        stored_path: '/a',
        category: 'Werbungskosten',
        extracted_data: {},
        ocr_confidence: 0.9
      });
      db.createDocument(userId, {
        original_filename: 'b.jpg',
        stored_path: '/b',
        category: 'Sonderausgaben',
        extracted_data: {},
        ocr_confidence: 0.9
      });

      const filtered = db.getDocumentsByCategory(userId, 'Werbungskosten');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe('Werbungskosten');
    });
  });

  // ========================================
  // Expense Operations
  // ========================================

  describe('Expense Operations', () => {
    let userId: string;

    beforeEach(() => {
      userId = db.createUser().id;
    });

    it('should create an expense', () => {
      const expense = db.createExpense(userId, {
        category: 'Fortbildung',
        amount: 500,
        date: '2024-06-15',
        description: 'TypeScript Kurs',
        receipt_ids: ['doc_1']
      });
      expect(expense.id).toBeDefined();
      expect(expense.amount).toBe(500);
    });

    it('should calculate totals by category', () => {
      db.createExpense(userId, {
        category: 'Fortbildung',
        amount: 300,
        date: '2024-01-01',
        description: 'Kurs 1',
        receipt_ids: []
      });
      db.createExpense(userId, {
        category: 'Fortbildung',
        amount: 200,
        date: '2024-02-01',
        description: 'Kurs 2',
        receipt_ids: []
      });
      db.createExpense(userId, {
        category: 'Arbeitsmittel',
        amount: 800,
        date: '2024-03-01',
        description: 'Laptop',
        receipt_ids: []
      });

      const totals = db.getTotalExpensesByCategory(userId);
      expect(totals['Fortbildung']).toBe(500);
      expect(totals['Arbeitsmittel']).toBe(800);
    });
  });

  // ========================================
  // Calculation Operations
  // ========================================

  describe('Calculation Operations', () => {
    let userId: string;
    let interviewId: string;

    beforeEach(() => {
      userId = db.createUser().id;
      interviewId = db.createInterview(userId, 2024).id;
    });

    it('should create a calculation', () => {
      const calc = db.createCalculation(userId, interviewId, {
        tax_year: 2024,
        total_income: 50000,
        total_deductions: 3000,
        estimated_refund: 900,
        calculation_details: { brackets: 'progressive' }
      });
      expect(calc.id).toBeDefined();
      expect(calc.estimated_refund).toBe(900);
    });

    it('should get latest calculation', () => {
      db.createCalculation(userId, interviewId, {
        tax_year: 2024,
        total_income: 50000,
        total_deductions: 3000,
        estimated_refund: 900,
        calculation_details: {}
      });

      const latest = db.getLatestCalculation(interviewId);
      expect(latest).not.toBeNull();
      expect(latest!.estimated_refund).toBe(900);
    });

    it('should return null when no calculations exist', () => {
      const result = db.getLatestCalculation('no-interview');
      expect(result).toBeNull();
    });
  });

  // ========================================
  // Form Operations
  // ========================================

  describe('Form Operations', () => {
    let userId: string;
    let interviewId: string;

    beforeEach(() => {
      userId = db.createUser().id;
      interviewId = db.createInterview(userId, 2024).id;
    });

    it('should create a form', () => {
      const form = db.createForm(userId, interviewId, 'L1', { data: 'test' });
      expect(form.id).toBeDefined();
      expect(form.form_type).toBe('L1');
      expect(form.status).toBe('draft');
    });

    it('should update form PDF path', () => {
      const form = db.createForm(userId, interviewId, 'L1');
      db.updateFormPath(form.id, '/output/l1.pdf');

      const updated = db.getForm(form.id);
      expect(updated!.pdf_path).toBe('/output/l1.pdf');
      expect(updated!.status).toBe('ready');
    });

    it('should list forms by interview', () => {
      db.createForm(userId, interviewId, 'L1');
      db.createForm(userId, interviewId, 'L1ab');
      db.createForm(userId, interviewId, 'L1k');

      const forms = db.getFormsByInterview(interviewId);
      expect(forms).toHaveLength(3);
      expect(forms.map(f => f.form_type).sort()).toEqual(['L1', 'L1ab', 'L1k']);
    });
  });

  // ========================================
  // Database Persistence
  // ========================================

  describe('Persistence', () => {
    it('should persist data to file', () => {
      db.createUser({ profession: 'Test' });
      db.close();

      // Verify file exists
      expect(fs.existsSync(dbPath)).toBe(true);

      // Reopen and verify data
      const db2 = new DatabaseService(dbPath);
      // Need to initialize before querying
      db2.initialize().then(() => {
        const users = db2.getAllUsers();
        expect(users).toHaveLength(1);
        expect(users[0].profile_data.profession).toBe('Test');
        db2.close();
      });
    });
  });
});
