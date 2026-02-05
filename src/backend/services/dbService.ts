/**
 * TaxLogic.local - Database Service
 *
 * SQLite-based local database using sql.js (pure JavaScript, no native deps)
 * Stores:
 * - User profiles
 * - Interview responses
 * - Documents & OCR results
 * - Expense records
 * - Tax calculations
 * - Generated forms
 */

import * as fs from 'fs';
import * as path from 'path';

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
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
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'db', 'taxlogic.db');
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize(): Promise<void> {
    // Initialize sql.js
    this.SQL = await initSqlJs();

    // Ensure db directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    await this.createTables();
    this.saveToFile();
  }

  /**
   * Save database to file
   */
  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        profile_data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Interviews table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tax_year INTEGER NOT NULL,
        responses TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'completed', 'submitted')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Documents table
    this.db.run(`
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
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
      )
    `);

    // Expenses table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        receipt_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
      )
    `);

    // Calculations table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS calculations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT NOT NULL,
        tax_year INTEGER NOT NULL,
        total_income REAL NOT NULL DEFAULT 0,
        total_deductions REAL NOT NULL DEFAULT 0,
        estimated_refund REAL NOT NULL DEFAULT 0,
        calculation_details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
      )
    `);

    // Forms table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        interview_id TEXT NOT NULL,
        form_type TEXT NOT NULL CHECK(form_type IN ('L1', 'L1ab', 'L1k')),
        pdf_path TEXT,
        json_data TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'submitted')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for common queries
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_interviews_tax_year ON interviews(tax_year)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_calculations_interview_id ON calculations(interview_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_forms_interview_id ON forms(interview_id)`);
  }

  // ========================================
  // User Operations
  // ========================================

  createUser(profile: UserProfile = {}): User {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO users (id, profile_data, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [id, JSON.stringify(profile), now, now]
    );

    this.saveToFile();
    return { id, profile_data: profile, created_at: now, updated_at: now };
  }

  getUser(id: string): User | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const columns = result[0].columns;
    const obj = this.rowToObject(columns, row);

    return {
      ...obj,
      profile_data: JSON.parse(obj.profile_data as string)
    } as User;
  }

  getAllUsers(): User[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM users ORDER BY created_at DESC');
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        profile_data: JSON.parse(obj.profile_data as string)
      } as User;
    });
  }

  updateUser(id: string, profile: Partial<UserProfile>): void {
    if (!this.db) throw new Error('Database not initialized');

    const user = this.getUser(id);
    if (!user) throw new Error(`User ${id} not found`);

    const updatedProfile = { ...user.profile_data, ...profile };
    const now = new Date().toISOString();

    this.db.run(
      `UPDATE users SET profile_data = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(updatedProfile), now, id]
    );

    this.saveToFile();
  }

  // ========================================
  // Interview Operations
  // ========================================

  createInterview(userId: string, taxYear: number): Interview {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO interviews (id, user_id, tax_year, responses, status, created_at, updated_at)
       VALUES (?, ?, ?, '{}', 'draft', ?, ?)`,
      [id, userId, taxYear, now, now]
    );

    this.saveToFile();
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

    const result = this.db.exec('SELECT * FROM interviews WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const obj = this.rowToObject(result[0].columns, row);

    return {
      ...obj,
      responses: JSON.parse(obj.responses as string)
    } as Interview;
  }

  getInterviewsByUser(userId: string): Interview[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM interviews WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        responses: JSON.parse(obj.responses as string)
      } as Interview;
    });
  }

  updateInterviewResponses(id: string, responses: Record<string, unknown>): void {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE interviews SET responses = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(responses), now, id]
    );

    this.saveToFile();
  }

  updateInterviewStatus(id: string, status: Interview['status']): void {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE interviews SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, id]
    );

    this.saveToFile();
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

    this.db.run(
      `INSERT INTO documents (id, user_id, interview_id, original_filename, stored_path, category, subcategory, extracted_data, ocr_confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    this.saveToFile();
    return {
      id,
      user_id: userId,
      ...data,
      created_at: now
    };
  }

  getDocument(id: string): Document | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM documents WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const obj = this.rowToObject(result[0].columns, row);

    return {
      ...obj,
      extracted_data: JSON.parse(obj.extracted_data as string)
    } as Document;
  }

  getDocumentsByUser(userId: string): Document[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        extracted_data: JSON.parse(obj.extracted_data as string)
      } as Document;
    });
  }

  getDocumentsByCategory(userId: string, category: string): Document[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM documents WHERE user_id = ? AND category = ?',
      [userId, category]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        extracted_data: JSON.parse(obj.extracted_data as string)
      } as Document;
    });
  }

  // ========================================
  // Expense Operations
  // ========================================

  createExpense(userId: string, data: Omit<Expense, 'id' | 'user_id' | 'created_at'>): Expense {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO expenses (id, user_id, interview_id, category, amount, date, description, receipt_ids, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.interview_id || null,
        data.category,
        data.amount,
        data.date,
        data.description,
        JSON.stringify(data.receipt_ids),
        now
      ]
    );

    this.saveToFile();
    return {
      id,
      user_id: userId,
      ...data,
      created_at: now
    };
  }

  getExpensesByUser(userId: string): Expense[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        receipt_ids: JSON.parse(obj.receipt_ids as string)
      } as Expense;
    });
  }

  getExpensesByCategory(userId: string, category: string): Expense[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM expenses WHERE user_id = ? AND category = ?',
      [userId, category]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        receipt_ids: JSON.parse(obj.receipt_ids as string)
      } as Expense;
    });
  }

  getTotalExpensesByCategory(userId: string, interviewId?: string): Record<string, number> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT category, SUM(amount) as total FROM expenses WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (interviewId) {
      query += ' AND interview_id = ?';
      params.push(interviewId);
    }

    query += ' GROUP BY category';

    const result = this.db.exec(query, params);
    if (result.length === 0) return {};

    const totals: Record<string, number> = {};
    result[0].values.forEach((row) => {
      const category = row[0] as string;
      const total = row[1] as number;
      totals[category] = total;
    });

    return totals;
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

    this.db.run(
      `INSERT INTO calculations (id, user_id, interview_id, tax_year, total_income, total_deductions, estimated_refund, calculation_details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        interviewId,
        data.tax_year,
        data.total_income,
        data.total_deductions,
        data.estimated_refund,
        JSON.stringify(data.calculation_details),
        now
      ]
    );

    this.saveToFile();
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

    const result = this.db.exec(
      'SELECT * FROM calculations WHERE interview_id = ? ORDER BY created_at DESC LIMIT 1',
      [interviewId]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const obj = this.rowToObject(result[0].columns, row);

    return {
      ...obj,
      calculation_details: JSON.parse(obj.calculation_details as string)
    } as Calculation;
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

    this.db.run(
      `INSERT INTO forms (id, user_id, interview_id, form_type, json_data, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [id, userId, interviewId, formType, JSON.stringify(jsonData), now]
    );

    this.saveToFile();
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

    this.db.run(
      `UPDATE forms SET pdf_path = ?, status = 'ready' WHERE id = ?`,
      [pdfPath, id]
    );

    this.saveToFile();
  }

  getFormsByInterview(interviewId: string): TaxForm[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM forms WHERE interview_id = ?',
      [interviewId]
    );
    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const obj = this.rowToObject(result[0].columns, row);
      return {
        ...obj,
        json_data: JSON.parse(obj.json_data as string)
      } as TaxForm;
    });
  }

  getForm(id: string): TaxForm | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM forms WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    const obj = this.rowToObject(result[0].columns, row);

    return {
      ...obj,
      json_data: JSON.parse(obj.json_data as string)
    } as TaxForm;
  }

  // ========================================
  // Utility Methods
  // ========================================

  private rowToObject(columns: string[], values: unknown[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }
}

// Singleton instance
export const dbService = new DatabaseService();
export default DatabaseService;
