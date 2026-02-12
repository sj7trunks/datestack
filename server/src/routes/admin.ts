import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { query, run, saveDatabase, reloadDatabase, getDatabasePath, isPostgres } from '../database';
import { AuthRequest, requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: '/tmp/datestack-uploads/' });

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// GET /api/admin/users - List all users with event counts
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<{
      id: number;
      email: string;
      created_at: string;
      event_count: number;
    }>(
      `SELECT u.id, u.email, u.created_at,
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

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
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

// GET /api/admin/backup - Download database backup (SQLite only)
router.get('/backup', async (req: AuthRequest, res: Response) => {
  if (isPostgres()) {
    return res.status(400).json({ error: 'Backup is only available for SQLite databases' });
  }

  try {
    saveDatabase();
    const dbPath = getDatabasePath();
    const filename = `datestack-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.download(dbPath, filename);
  } catch (error) {
    console.error('Admin backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /api/admin/restore - Restore database from upload (SQLite only)
router.post('/restore', upload.single('database'), async (req: AuthRequest, res: Response) => {
  if (isPostgres()) {
    return res.status(400).json({ error: 'Restore is only available for SQLite databases' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const dbPath = getDatabasePath();

    // Backup current database first
    saveDatabase();
    const backupPath = dbPath + '.bak-' + Date.now();
    fs.copyFileSync(dbPath, backupPath);

    // Write uploaded file as new database
    fs.copyFileSync(req.file.path, dbPath);

    // Clean up uploaded temp file
    fs.unlinkSync(req.file.path);

    // Reload the database
    await reloadDatabase();

    res.json({ message: 'Database restored successfully', backup: path.basename(backupPath) });
  } catch (error) {
    console.error('Admin restore error:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

export default router;
