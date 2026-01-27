import { Router, Response } from 'express';
import { query, queryOne, run, AgendaItem } from '../database';
import { AuthRequest, requireAnyAuth } from '../middleware/auth';

const router = Router();

// GET /api/agenda - List agenda items
router.get('/', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const { date, include_completed } = req.query;

  // Default to today's date
  const targetDate = date || new Date().toISOString().split('T')[0];

  let sql = 'SELECT * FROM agenda_items WHERE user_id = ? AND date = ?';
  const params: any[] = [req.user!.id, targetDate];

  if (include_completed !== 'true') {
    sql += ' AND completed = 0';
  }

  sql += ' ORDER BY created_at ASC';

  try {
    const items = query<AgendaItem>(sql, params);
    res.json(items);
  } catch (error) {
    console.error('Get agenda items error:', error);
    res.status(500).json({ error: 'Failed to fetch agenda items' });
  }
});

// GET /api/agenda/range - List agenda items for a date range
router.get('/range', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const { start, end, include_completed } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'start and end dates are required' });
  }

  let sql = 'SELECT * FROM agenda_items WHERE user_id = ? AND date >= ? AND date <= ?';
  const params: any[] = [req.user!.id, start, end];

  if (include_completed !== 'true') {
    sql += ' AND completed = 0';
  }

  sql += ' ORDER BY date ASC, created_at ASC';

  try {
    const items = query<AgendaItem>(sql, params);
    res.json(items);
  } catch (error) {
    console.error('Get agenda items range error:', error);
    res.status(500).json({ error: 'Failed to fetch agenda items' });
  }
});

// POST /api/agenda - Create agenda item
router.post('/', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const { text, date } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Default to today's date
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const result = run(
      'INSERT INTO agenda_items (user_id, text, date) VALUES (?, ?, ?)',
      [req.user!.id, text, targetDate]
    );

    const item = queryOne<AgendaItem>('SELECT * FROM agenda_items WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json(item);
  } catch (error) {
    console.error('Create agenda item error:', error);
    res.status(500).json({ error: 'Failed to create agenda item' });
  }
});

// PATCH /api/agenda/:id - Update agenda item (complete/uncomplete)
router.patch('/:id', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const itemId = parseInt(req.params.id, 10);
  const { text, date, completed } = req.body;

  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  // Verify ownership
  const existing = queryOne<AgendaItem>(
    'SELECT * FROM agenda_items WHERE id = ? AND user_id = ?',
    [itemId, req.user!.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Agenda item not found' });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (text !== undefined) {
      updates.push('text = ?');
      values.push(text);
    }

    if (date !== undefined) {
      updates.push('date = ?');
      values.push(date);
    }

    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);

      if (completed) {
        updates.push('completed_at = datetime("now")');
      } else {
        updates.push('completed_at = NULL');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(itemId);
    run(`UPDATE agenda_items SET ${updates.join(', ')} WHERE id = ?`, values);

    const item = queryOne<AgendaItem>('SELECT * FROM agenda_items WHERE id = ?', [itemId]);
    res.json(item);
  } catch (error) {
    console.error('Update agenda item error:', error);
    res.status(500).json({ error: 'Failed to update agenda item' });
  }
});

// DELETE /api/agenda/:id - Delete agenda item
router.delete('/:id', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const itemId = parseInt(req.params.id, 10);

  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  // Verify ownership
  const existing = queryOne<AgendaItem>(
    'SELECT * FROM agenda_items WHERE id = ? AND user_id = ?',
    [itemId, req.user!.id]
  );

  if (!existing) {
    return res.status(404).json({ error: 'Agenda item not found' });
  }

  try {
    run('DELETE FROM agenda_items WHERE id = ?', [itemId]);
    res.json({ message: 'Agenda item deleted' });
  } catch (error) {
    console.error('Delete agenda item error:', error);
    res.status(500).json({ error: 'Failed to delete agenda item' });
  }
});

// POST /api/agenda/rollover - Move incomplete items to today
router.post('/rollover', requireAnyAuth, (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = run(
      'UPDATE agenda_items SET date = ? WHERE user_id = ? AND completed = 0 AND date < ?',
      [today, req.user!.id, today]
    );

    res.json({
      message: 'Rollover complete',
      items_moved: result.changes,
    });
  } catch (error) {
    console.error('Rollover error:', error);
    res.status(500).json({ error: 'Failed to rollover agenda items' });
  }
});

export default router;
