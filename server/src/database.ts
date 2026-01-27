import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase;

const dbPath = process.env.DATABASE_URL || './data/datestack.db';
const dbDir = path.dirname(dbPath);

// Initialize database
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  // Ensure the database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize schema
  db.run(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- API Keys table
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Calendar Sources table
    CREATE TABLE IF NOT EXISTS calendar_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      last_sync DATETIME
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES calendar_sources(id) ON DELETE CASCADE,
      external_id TEXT,
      title TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      location TEXT,
      notes TEXT,
      all_day BOOLEAN DEFAULT FALSE,
      calendar_name TEXT,
      UNIQUE(source_id, external_id)
    );

    -- Agenda Items table
    CREATE TABLE IF NOT EXISTS agenda_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      date DATE NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Availability Settings table
    CREATE TABLE IF NOT EXISTS availability_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT FALSE,
      start_hour INTEGER DEFAULT 8,
      end_hour INTEGER DEFAULT 17,
      share_token TEXT UNIQUE,
      days_ahead INTEGER DEFAULT 14,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agenda_items_user_date ON agenda_items(user_id, date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)`);

  // Migration: Add calendar_name column if it doesn't exist
  try {
    const tableInfo = db.exec("PRAGMA table_info(events)");
    const columns = tableInfo[0]?.values || [];
    const hasCalendarName = columns.some((col: any) => col[1] === 'calendar_name');
    if (!hasCalendarName) {
      db.run('ALTER TABLE events ADD COLUMN calendar_name TEXT');
    }
  } catch (e) {
    // Column likely already exists or table doesn't exist yet
  }

  // Save database to disk
  saveDatabase();

  return db;
}

// Save database to disk
export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Get database instance
export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper to run a query and get results as objects
export function query<T>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to run a query and get first result
export function queryOne<T>(sql: string, params: any[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

// Helper to run an insert/update/delete and get lastInsertRowid
export function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = query<{ id: number }>('SELECT last_insert_rowid() as id')[0]?.id || 0;
  saveDatabase(); // Persist changes
  return { changes, lastInsertRowid: lastId };
}

// Type definitions for database rows
export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ApiKey {
  id: number;
  user_id: number;
  key: string;
  name: string;
  created_at: string;
}

export interface CalendarSource {
  id: number;
  user_id: number;
  name: string;
  color: string;
  last_sync: string | null;
}

export interface Event {
  id: number;
  source_id: number;
  external_id: string | null;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  all_day: boolean;
  calendar_name: string | null;
}

export interface AgendaItem {
  id: number;
  user_id: number;
  text: string;
  date: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface AvailabilitySettings {
  id: number;
  user_id: number;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  share_token: string | null;
  days_ahead: number;
  created_at: string;
  updated_at: string;
}
