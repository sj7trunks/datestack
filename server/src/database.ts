import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || './data/datestack.db';
const isPg = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

// SQLite state
let sqliteDb: SqlJsDatabase | null = null;
const dbPath = DATABASE_URL;
const dbDir = path.dirname(dbPath);

// PostgreSQL state
let pgPool: any = null;

// --- SQL dialect translation (SQLite → PG) ---

function toPgSql(sql: string): string {
  let s = sql;
  // datetime("now") → NOW()
  s = s.replace(/datetime\s*\(\s*["']now["']\s*\)/gi, 'NOW()');
  // substr( → SUBSTRING(
  s = s.replace(/\bsubstr\s*\(/gi, 'SUBSTRING(');
  // Boolean column comparisons with literal 0/1
  s = s.replace(/\b(enabled|completed|all_day|is_admin)\s*=\s*1\b/g, '$1 = TRUE');
  s = s.replace(/\b(enabled|completed|all_day|is_admin)\s*=\s*0\b/g, '$1 = FALSE');
  return s;
}

function convertPlaceholders(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

function toPg(sql: string): string {
  return convertPlaceholders(toPgSql(sql));
}

// --- Schema ---

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    last_sync DATETIME
  );

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

  CREATE TABLE IF NOT EXISTS agenda_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    calendar_name TEXT NOT NULL,
    color TEXT NOT NULL,
    UNIQUE(user_id, calendar_name)
  );

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
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_sources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    last_sync TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES calendar_sources(id) ON DELETE CASCADE,
    external_id TEXT,
    title TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location TEXT,
    notes TEXT,
    all_day BOOLEAN DEFAULT FALSE,
    calendar_name TEXT,
    UNIQUE(source_id, external_id)
  );

  CREATE TABLE IF NOT EXISTS agenda_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_colors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    calendar_name TEXT NOT NULL,
    color TEXT NOT NULL,
    UNIQUE(user_id, calendar_name)
  );

  CREATE TABLE IF NOT EXISTS availability_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    start_hour INTEGER DEFAULT 8,
    end_hour INTEGER DEFAULT 17,
    share_token TEXT UNIQUE,
    days_ahead INTEGER DEFAULT 14,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// --- Initialize database ---

export async function initDatabase(): Promise<any> {
  if (isPg) {
    const pg = await import('pg');
    const { Pool } = pg;

    // Override pg type parsers so DATE and TIMESTAMP columns return strings
    // instead of JavaScript Date objects (keeps output consistent with SQLite)
    const types = pg.types;
    // DATE (OID 1082) → return as 'YYYY-MM-DD' string
    types.setTypeParser(1082, (val: string) => val);
    // TIMESTAMP (OID 1114) → return as string
    types.setTypeParser(1114, (val: string) => val);
    // TIMESTAMPTZ (OID 1184) → return as string
    types.setTypeParser(1184, (val: string) => val);
    pgPool = new Pool({ connectionString: DATABASE_URL });

    // Create schema
    await pgPool.query(PG_SCHEMA);

    // Create indexes
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_agenda_items_user_date ON agenda_items(user_id, date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)');

    // Migration: ensure calendar_name column exists
    try {
      const result = await pgPool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'calendar_name'"
      );
      if (result.rows.length === 0) {
        await pgPool.query('ALTER TABLE events ADD COLUMN calendar_name TEXT');
      }
    } catch (e) {
      // Column likely already exists
    }

    // Migration: ensure is_admin column exists on users
    try {
      const result = await pgPool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin'"
      );
      if (result.rows.length === 0) {
        await pgPool.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
      }
    } catch (e) {
      // Column likely already exists
    }

    console.log('PostgreSQL backend initialized');
    return pgPool;
  }

  // SQLite backend
  if (sqliteDb) return sqliteDb;

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqliteDb = new SQL.Database(fileBuffer);
  } else {
    sqliteDb = new SQL.Database();
  }

  sqliteDb.run(SQLITE_SCHEMA);

  // Create indexes
  sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id)');
  sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)');
  sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_agenda_items_user_date ON agenda_items(user_id, date)');
  sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)');

  // Migration: Add calendar_name column if it doesn't exist
  try {
    const tableInfo = sqliteDb.exec("PRAGMA table_info(events)");
    const columns = tableInfo[0]?.values || [];
    const hasCalendarName = columns.some((col: any) => col[1] === 'calendar_name');
    if (!hasCalendarName) {
      sqliteDb.run('ALTER TABLE events ADD COLUMN calendar_name TEXT');
    }
  } catch (e) {
    // Column likely already exists or table doesn't exist yet
  }

  // Migration: Add is_admin column if it doesn't exist
  try {
    const tableInfo = sqliteDb.exec("PRAGMA table_info(users)");
    const columns = tableInfo[0]?.values || [];
    const hasIsAdmin = columns.some((col: any) => col[1] === 'is_admin');
    if (!hasIsAdmin) {
      sqliteDb.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
    }
  } catch (e) {
    // Column likely already exists
  }

  saveDatabase();
  console.log('SQLite backend initialized');
  return sqliteDb;
}

// --- Save database to disk (SQLite only) ---

export function saveDatabase(): void {
  if (isPg || !sqliteDb) return;
  const data = sqliteDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// --- Reload database (SQLite only, for restore) ---

export async function reloadDatabase(): Promise<void> {
  if (isPg) return;
  sqliteDb = null;
  await initDatabase();
}

// --- Get database path (SQLite only) ---

export function getDatabasePath(): string {
  return dbPath;
}

export function isPostgres(): boolean {
  return isPg;
}

// --- Get database instance ---

export function getDb(): any {
  if (isPg) {
    if (!pgPool) throw new Error('Database not initialized. Call initDatabase() first.');
    // Return a wrapper with exec() for health check compatibility
    return {
      exec: () => {
        if (!pgPool || pgPool.ending) {
          throw new Error('PostgreSQL pool is not available');
        }
      },
    };
  }
  if (!sqliteDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return sqliteDb;
}

// --- Query helpers ---

export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  if (isPg) {
    const pgSql = toPg(sql);
    const result = await pgPool.query(pgSql, params);
    return result.rows;
  }
  // SQLite
  const stmt = sqliteDb!.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  const results = await query<T>(sql, params);
  return results[0];
}

export async function run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  if (isPg) {
    let pgSql = toPg(sql);
    const isInsert = /^\s*INSERT\s/i.test(sql);
    if (isInsert) {
      pgSql += ' RETURNING id';
    }
    const result = await pgPool.query(pgSql, params);
    return {
      changes: result.rowCount || 0,
      lastInsertRowid: isInsert ? (result.rows[0]?.id || 0) : 0,
    };
  }
  // SQLite
  sqliteDb!.run(sql, params);
  const changes = sqliteDb!.getRowsModified();
  const stmt = sqliteDb!.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const lastId = (stmt.getAsObject() as any).id || 0;
  stmt.free();
  saveDatabase();
  return { changes, lastInsertRowid: lastId };
}

// --- Utility ---

export function getToday(): string {
  const tz = process.env.TIMEZONE || 'America/Los_Angeles';
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

// --- Type definitions ---

export interface User {
  id: number;
  email: string;
  password_hash: string;
  is_admin: boolean;
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
