import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { query, run, saveDatabase, reloadDatabase, getDatabasePath, isPostgres } from '../database';
import { AuthRequest, requireAuth, requireAdmin, validatePasswordStrength } from '../middleware/auth';

const router = Router();

// BUG-005 FIX: Add file size limit (50MB) and file type validation to prevent DoS and malicious uploads
const upload = multer({
  dest: '/tmp/datestack-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/octet-stream', 'application/x-sqlite3', 'application/json'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.db') || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only .db and .json backup files are allowed'));
    }
  },
});

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// Table names in dependency order (parents before children)
const TABLE_ORDER = [
  'users',
  'api_keys',
  'calendar_sources',
  'events',
  'agenda_items',
  'calendar_colors',
  'availability_settings',
];

// BUG-002 FIX: Schema whitelist to prevent SQL injection via column names in backup restore
const ALLOWED_COLUMNS: Record<string, string[]> = {
  users: ['id', 'email', 'password_hash', 'is_admin', 'created_at'],
  api_keys: ['id', 'user_id', 'key', 'name', 'created_at'],
  calendar_sources: ['id', 'user_id', 'name', 'color', 'last_sync'],
  events: ['id', 'source_id', 'external_id', 'title', 'start_time', 'end_time', 'location', 'notes', 'all_day', 'calendar_name'],
  agenda_items: ['id', 'user_id', 'text', 'date', 'completed', 'completed_at', 'created_at'],
  calendar_colors: ['id', 'user_id', 'calendar_name', 'color'],
  availability_settings: ['id', 'user_id', 'enabled', 'start_hour', 'end_hour', 'share_token', 'days_ahead', 'created_at', 'updated_at'],
};

// Validate that column names from backup data match the known schema
function validateColumns(table: string, columns: string[]): string[] {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) {
    throw new Error(`Unknown table: ${table}`);
  }
  const invalid = columns.filter(col => !allowed.includes(col));
  if (invalid.length > 0) {
    throw new Error(`Invalid columns in table "${table}": ${invalid.join(', ')}. Possible SQL injection attempt.`);
  }
  return columns;
}

// GET /api/admin/users - List all users with event counts
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<{
      id: number;
      email: string;
      created_at: string;
      event_count: number;
      is_admin: boolean;
    }>(
      `SELECT u.id, u.email, u.created_at, u.is_admin,
        (SELECT COUNT(*) FROM events e
         INNER JOIN calendar_sources cs ON e.source_id = cs.id
         WHERE cs.user_id = u.id) as event_count
       FROM users u
       ORDER BY u.id ASC`
    );
    res.json(users);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:id/reset-password - Reset a user's password
router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  const { password } = req.body;

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/admin/backup - Download database backup
router.get('/backup', async (req: AuthRequest, res: Response) => {
  try {
    if (isPostgres()) {
      // PG: dump all tables as JSON
      const dump: Record<string, any[]> = {};
      for (const table of TABLE_ORDER) {
        dump[table] = await query(`SELECT * FROM ${table}`);
      }
      const filename = `datestack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({ format: 'datestack-pg-backup', version: 1, tables: dump });
    } else {
      // SQLite: download .db file
      saveDatabase();
      const dbPath = getDatabasePath();
      const filename = `datestack-backup-${new Date().toISOString().slice(0, 10)}.db`;
      res.download(dbPath, filename);
    }
  } catch (error) {
    console.error('Admin backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /api/admin/restore - Restore database from upload
router.post('/restore', upload.single('database'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const adminEmail = req.user!.email;

  try {
    if (isPostgres()) {
      // PG: restore from JSON backup or SQLite .db file
      const fileBuffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);

      // Determine format: try JSON first, then SQLite
      let tables: Record<string, any[]> = {};

      const content = fileBuffer.toString('utf-8');
      let isJson = false;
      try {
        const data = JSON.parse(content);
        if (data.tables && data.format === 'datestack-pg-backup') {
          tables = data.tables;
          isJson = true;
        }
      } catch {
        // Not JSON - try as SQLite
      }

      if (!isJson) {
        // Try to open as SQLite database
        try {
          const SQL = await initSqlJs();
          const sqliteDb = new SQL.Database(fileBuffer);

          for (const table of TABLE_ORDER) {
            try {
              const stmt = sqliteDb.prepare(`SELECT * FROM ${table}`);
              const rows: any[] = [];
              while (stmt.step()) {
                rows.push(stmt.getAsObject());
              }
              stmt.free();
              tables[table] = rows;
            } catch {
              // Table might not exist in this backup
              tables[table] = [];
            }
          }

          sqliteDb.close();
        } catch (e) {
          return res.status(400).json({ error: 'Invalid backup file. Expected JSON or SQLite (.db) format.' });
        }
      }

      // BUG-005 FIX: Validate backup structure matches expected schema
      const unknownTables = Object.keys(tables).filter(t => !TABLE_ORDER.includes(t));
      if (unknownTables.length > 0) {
        return res.status(400).json({ error: `Backup contains unknown tables: ${unknownTables.join(', ')}` });
      }

      for (const table of TABLE_ORDER) {
        const rows = tables[table];
        if (!rows || rows.length === 0) continue;

        // Validate that rows are plain objects with only allowed columns
        for (const row of rows) {
          if (typeof row !== 'object' || row === null || Array.isArray(row)) {
            return res.status(400).json({ error: `Invalid row data in table "${table}"` });
          }
          const cols = Object.keys(row);
          try {
            validateColumns(table, cols);
          } catch (err: any) {
            return res.status(400).json({ error: err.message });
          }
        }
      }

      // Truncate all tables in reverse dependency order
      const reverseTables = [...TABLE_ORDER].reverse();
      for (const table of reverseTables) {
        await run(`DELETE FROM ${table}`, []);
      }

      // Insert rows in dependency order (with column validation to prevent SQL injection)
      for (const table of TABLE_ORDER) {
        const rows = tables[table];
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          const cols = Object.keys(row);
          // BUG-002 FIX: Validate column names against known schema whitelist
          const validatedCols = validateColumns(table, cols);
          const vals = Object.values(row);
          await run(
            `INSERT INTO ${table} (${validatedCols.join(', ')}) VALUES (${validatedCols.map(() => '?').join(', ')})`,
            vals
          );
        }
      }

      // Reset sequences for all tables
      for (const table of TABLE_ORDER) {
        try {
          await run(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`, []);
        } catch {
          // Table might not have a sequence
        }
      }

      // Ensure restoring user retains admin
      await run('UPDATE users SET is_admin = ? WHERE email = ?', [true, adminEmail]);

      res.json({ message: 'Database restored successfully', backup: 'pre-restore state available via pg_dump' });
    } else {
      // SQLite: restore from .db file
      const dbPath = getDatabasePath();

      // Backup current database first
      saveDatabase();
      const backupPath = dbPath + '.bak-' + Date.now();
      fs.copyFileSync(dbPath, backupPath);

      // Write uploaded file as new database
      fs.copyFileSync(req.file.path, dbPath);

      // Clean up uploaded temp file
      fs.unlinkSync(req.file.path);

      // Reload the database (runs migrations including is_admin column)
      await reloadDatabase();

      // Ensure the restoring user retains admin in the restored DB
      await run('UPDATE users SET is_admin = 1 WHERE email = ?', [adminEmail]);

      res.json({ message: 'Database restored successfully', backup: path.basename(backupPath) });
    }
  } catch (error) {
    console.error('Admin restore error:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

export default router;
