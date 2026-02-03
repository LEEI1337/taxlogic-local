/**
 * TaxLogic.local - Database Service
 *
 * SQLite-based local database for storing:
 * - User profiles
 * - Interview responses
 * - Documents & OCR results
 * - Expense records
 * - Tax calculations
 * - Generated forms
 */

import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ========================================
// Type Definitions
// ========================================

export interface User {
  id: string;
  profile_data: UserProfile;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  profession?: string;
  income_source?: string;
  annual_income?: number;
  employment_status?: 'employee' | 'freelancer' | 'business_owner' | 'retired' | 'other';
  location?: string;
}

export interface Interview {
  id: string;
  user_id: string;
  tax_year: number;
  responses: Record<string, unknown>;
  status: 'draft' | 'completed' | 'submitted';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  interview_id?: string;
  original_filename: string;
  stored_path: string;
  category: string;
  subcategory?: string;
  extracted_data: Record<string, unknown>;
  ocr_confidence: number;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  interview_id?: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  receipt_ids: string[];
  created_at: string;
}

export interface Calculation {
  id: string;
  user_id: string;
  interview_id: string;
  tax_year: number;
  total_income: number;
  total_deductions: number;
  estimated_refund: number;
  calculation_details: Record<string, unknown>;
  created_at: string;
}

export interface TaxForm {
  id: string;
  user_id: string;
  interview_id: string;
  form_type: 'L1' | 'L1ab' | 'L1k';
  pdf_path?: string;
  json_data: Record<string, unknown>;
  status: 'draft' | 'ready' | 'submitted';
  created_at: string;
}

// ========================================
// Database Service Class
// ========================================

class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'db', 'taxlogic.db');
  }

  /**
   * Initialize the database connection and create tables
   */
  initialize(): void {
    this.db = new Database(this.dbPath);

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');

    this.createTables();
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Create all database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        profile_data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Interviews table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tax_year INTEGER NOT NULL,
        responses TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'completed', 'submitted')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT,
        original_filename TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        extracted_data TEXT NOT NULL DEFAULT '{}',
        ocr_confidence REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
      )
    `);

    // Expenses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        receipt_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
      )
    `);

    // Calculations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calculations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT NOT NULL,
        tax_year INTEGER NOT NULL,
        total_income REAL NOT NULL DEFAULT 0,
        total_deductions REAL NOT NULL DEFAULT 0,
        estimated_refund REAL NOT NULL DEFAULT 0,
        calculation_details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
      )
    `);

    // Forms table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT NOT NULL,
        form_type TEXT NOT NULL CHECK(form_type IN ('L1', 'L1ab', 'L1k')),
        pdf_path TEXT,
        json_data TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'submitted')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
      CREATE INDEX IF NOT EXISTS idx_interviews_tax_year ON interviews(tax_year);
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_calculations_interview_id ON calculations(interview_id);
      CREATE INDEX IF NOT EXISTS idx_forms_interview_id ON forms(interview_id);
    `);
  }

  // ========================================
  // User Operations
  // ========================================

  createUser(profile: UserProfile = {}): User {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, profile_data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, JSON.stringify(profile), now, now);

    return { id, profile_data: profile, created_at: now, updated_at: now };
  }

  getUser(id: string): User | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      ...row,
      profile_data: JSON.parse(row.profile_data)
    };
  }

  updateUser(id: string, profile: Partial<UserProfile>): void {
    if (!this.db) throw new Error('Database not initialized');

    const user = this.getUser(id);
    if (!user) throw new Error(`User ${id} not found`);

    const updatedProfile = { ...user.profile_data, ...profile };

    this.db.prepare(`
      UPDATE users SET profile_data = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(updatedProfile), id);
  }

  // ========================================
  // Interview Operations
  // ========================================

  createInterview(userId: string, taxYear: number): Interview {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO interviews (id, user_id, tax_year, responses, status, created_at, updated_at)
      VALUES (?, ?, ?, '{}', 'draft', ?, ?)
    `).run(id, userId, taxYear, now, now);

    return {
      id,
      user_id: userId,
      tax_year: taxYear,
      responses: {},
      status: 'draft',
      created_at: now,
      updated_at: now
    };
  }

  getInterview(id: string): Interview | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM interviews WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      ...row,
      responses: JSON.parse(row.responses)
    };
  }

  getInterviewsByUser(userId: string): Interview[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM interviews WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

    return rows.map((row) => ({
      ...row,
      responses: JSON.parse(row.responses)
    }));
  }

  updateInterviewResponses(id: string, responses: Record<string, unknown>): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE interviews SET responses = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(responses), id);
  }

  updateInterviewStatus(id: string, status: Interview['status']): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE interviews SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);
  }

  // ========================================
  // Document Operations
  // ========================================

  createDocument(
    userId: string,
    data: Omit<Document, 'id' | 'user_id' | 'created_at'>
  ): Document {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO documents (id, user_id, interview_id, original_filename, stored_path, category, subcategory, extracted_data, ocr_confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      data.interview_id || null,
      data.original_filename,
      data.stored_path,
      data.category,
      data.subcategory || null,
      JSON.stringify(data.extracted_data),
      data.ocr_confidence,
      now
    );

    return {
      id,
      user_id: userId,
      ...data,
      created_at: now
    };
  }

  getDocumentsByUser(userId: string): Document[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

    return rows.map((row) => ({
      ...row,
      extracted_data: JSON.parse(row.extracted_data)
    }));
  }

  getDocumentsByCategory(userId: string, category: string): Document[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM documents WHERE user_id = ? AND category = ?').all(userId, category) as any[];

    return rows.map((row) => ({
      ...row,
      extracted_data: JSON.parse(row.extracted_data)
    }));
  }

  // ========================================
  // Expense Operations
  // ========================================

  createExpense(userId: string, data: Omit<Expense, 'id' | 'user_id' | 'created_at'>): Expense {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO expenses (id, user_id, interview_id, category, amount, date, description, receipt_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      data.interview_id || null,
      data.category,
      data.amount,
      data.date,
      data.description,
      JSON.stringify(data.receipt_ids),
      now
    );

    return {
      id,
      user_id: userId,
      ...data,
      created_at: now
    };
  }

  getExpensesByUser(userId: string): Expense[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC').all(userId) as any[];

    return rows.map((row) => ({
      ...row,
      receipt_ids: JSON.parse(row.receipt_ids)
    }));
  }

  getExpensesByCategory(userId: string, category: string): Expense[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM expenses WHERE user_id = ? AND category = ?').all(userId, category) as any[];

    return rows.map((row) => ({
      ...row,
      receipt_ids: JSON.parse(row.receipt_ids)
    }));
  }

  getTotalExpensesByCategory(userId: string, interviewId?: string): Record<string, number> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ?';
    const params: (string | undefined)[] = [userId];

    if (interviewId) {
      query += ' AND interview_id = ?';
      params.push(interviewId);
    }

    query += ' GROUP BY category';

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.reduce((acc, row) => {
      acc[row.category] = row.total;
      return acc;
    }, {} as Record<string, number>);
  }

  // ========================================
  // Calculation Operations
  // ========================================

  createCalculation(
    userId: string,
    interviewId: string,
    data: Omit<Calculation, 'id' | 'user_id' | 'interview_id' | 'created_at'>
  ): Calculation {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO calculations (id, user_id, interview_id, tax_year, total_income, total_deductions, estimated_refund, calculation_details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      interviewId,
      data.tax_year,
      data.total_income,
      data.total_deductions,
      data.estimated_refund,
      JSON.stringify(data.calculation_details),
      now
    );

    return {
      id,
      user_id: userId,
      interview_id: interviewId,
      ...data,
      created_at: now
    };
  }

  getLatestCalculation(interviewId: string): Calculation | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare(
      'SELECT * FROM calculations WHERE interview_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(interviewId) as any;

    if (!row) return null;

    return {
      ...row,
      calculation_details: JSON.parse(row.calculation_details)
    };
  }

  // ========================================
  // Form Operations
  // ========================================

  createForm(
    userId: string,
    interviewId: string,
    formType: TaxForm['form_type'],
    jsonData: Record<string, unknown> = {}
  ): TaxForm {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO forms (id, user_id, interview_id, form_type, json_data, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?)
    `).run(id, userId, interviewId, formType, JSON.stringify(jsonData), now);

    return {
      id,
      user_id: userId,
      interview_id: interviewId,
      form_type: formType,
      json_data: jsonData,
      status: 'draft',
      created_at: now
    };
  }

  updateFormPath(id: string, pdfPath: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE forms SET pdf_path = ?, status = 'ready'
      WHERE id = ?
    `).run(pdfPath, id);
  }

  getFormsByInterview(interviewId: string): TaxForm[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM forms WHERE interview_id = ?').all(interviewId) as any[];

    return rows.map((row) => ({
      ...row,
      json_data: JSON.parse(row.json_data)
    }));
  }
}

// Singleton instance
export const dbService = new DatabaseService();
export default DatabaseService;
