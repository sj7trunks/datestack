import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, run, ApiKey } from '../database';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/keys - List user's API keys
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const keys = query<{ id: number; name: string; created_at: string; key_preview: string }>(
    "SELECT id, name, created_at, substr(key, 1, 8) || '...' as key_preview FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
    [req.user!.id]
  );

  res.json(keys);
});

// POST /api/keys - Create new API key
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Generate a unique API key with prefix
  const key = `dsk_${uuidv4().replace(/-/g, '')}`;

  try {
    const result = run(
      'INSERT INTO api_keys (user_id, key, name) VALUES (?, ?, ?)',
      [req.user!.id, key, name]
    );

    // Return the full key only on creation
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      key,
      message: 'Save this key - it will not be shown again',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// DELETE /api/keys/:id - Revoke API key
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const keyId = parseInt(req.params.id, 10);

  if (isNaN(keyId)) {
    return res.status(400).json({ error: 'Invalid key ID' });
  }

  // Verify the key belongs to the user
  const key = queryOne<ApiKey>('SELECT * FROM api_keys WHERE id = ? AND user_id = ?', [keyId, req.user!.id]);

  if (!key) {
    return res.status(404).json({ error: 'API key not found' });
  }

  try {
    run('DELETE FROM api_keys WHERE id = ?', [keyId]);
    res.json({ message: 'API key revoked' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
