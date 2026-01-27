import { Router, Response } from 'express';
import { query, queryOne, run, CalendarSource } from '../database';
import { AuthRequest, requireAnyAuth } from '../middleware/auth';

const router = Router();

// GET /api/sources - List calendar sources
router.get('/', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const sources = query<CalendarSource>(
    'SELECT * FROM calendar_sources WHERE user_id = ? ORDER BY name',
    [req.user!.id]
  );

  res.json(sources);
});

// POST /api/sources - Create calendar source
router.post('/', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = run(
      'INSERT INTO calendar_sources (user_id, name, color) VALUES (?, ?, ?)',
      [req.user!.id, name, color || '#3B82F6']
    );

    const source = queryOne<CalendarSource>('SELECT * FROM calendar_sources WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json(source);
  } catch (error) {
    console.error('Create source error:', error);
    res.status(500).json({ error: 'Failed to create calendar source' });
  }
});

// GET /api/sources/:id - Get single source
router.get('/:id', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const sourceId = parseInt(req.params.id, 10);

  if (isNaN(sourceId)) {
    return res.status(400).json({ error: 'Invalid source ID' });
  }

  const source = queryOne<CalendarSource>(
    'SELECT * FROM calendar_sources WHERE id = ? AND user_id = ?',
    [sourceId, req.user!.id]
  );

  if (!source) {
    return res.status(404).json({ error: 'Calendar source not found' });
  }

  res.json(source);
});

// PATCH /api/sources/:id - Update calendar source
router.patch('/:id', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const sourceId = parseInt(req.params.id, 10);
  const { name, color } = req.body;

  if (isNaN(sourceId)) {
    return res.status(400).json({ error: 'Invalid source ID' });
  }

  // Verify ownership
  const existing = queryOne<CalendarSource>(
    'SELECT * FROM calendar_sources WHERE id = ? AND user_id = ?',
    [sourceId, req.user!.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Calendar source not found' });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(sourceId);
    run(`UPDATE calendar_sources SET ${updates.join(', ')} WHERE id = ?`, values);

    const source = queryOne<CalendarSource>('SELECT * FROM calendar_sources WHERE id = ?', [sourceId]);
    res.json(source);
  } catch (error) {
    console.error('Update source error:', error);
    res.status(500).json({ error: 'Failed to update calendar source' });
  }
});

// DELETE /api/sources/:id - Delete calendar source
router.delete('/:id', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const sourceId = parseInt(req.params.id, 10);

  if (isNaN(sourceId)) {
    return res.status(400).json({ error: 'Invalid source ID' });
  }

  // Verify ownership
  const existing = queryOne<CalendarSource>(
    'SELECT * FROM calendar_sources WHERE id = ? AND user_id = ?',
    [sourceId, req.user!.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Calendar source not found' });
  }

  try {
    // Delete events first (no cascade in sql.js)
    run('DELETE FROM events WHERE source_id = ?', [sourceId]);
    run('DELETE FROM calendar_sources WHERE id = ?', [sourceId]);
    res.json({ message: 'Calendar source deleted' });
  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({ error: 'Failed to delete calendar source' });
  }
});

export default router;
