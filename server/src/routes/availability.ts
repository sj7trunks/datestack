import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, run, AvailabilitySettings, Event, CalendarSource, getToday } from '../database';
import { AuthRequest, requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/availability - Get current user's availability settings
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE user_id = ?',
      [req.user!.id]
    );

    // Return defaults if no settings exist
    if (!settings) {
      settings = {
        id: 0,
        user_id: req.user!.id,
        enabled: false,
        start_hour: 8,
        end_hour: 17,
        share_token: null,
        days_ahead: 14,
        created_at: '',
        updated_at: '',
      };
    }

    res.json(settings);
  } catch (error) {
    console.error('Get availability settings error:', error);
    res.status(500).json({ error: 'Failed to fetch availability settings' });
  }
});

// PATCH /api/availability - Update availability settings
router.patch('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { enabled, start_hour, end_hour, days_ahead } = req.body;

  // Validate numeric ranges
  if (start_hour !== undefined && (typeof start_hour !== 'number' || start_hour < 0 || start_hour > 23)) {
    return res.status(400).json({ error: 'start_hour must be a number between 0 and 23' });
  }
  if (end_hour !== undefined && (typeof end_hour !== 'number' || end_hour < 0 || end_hour > 23)) {
    return res.status(400).json({ error: 'end_hour must be a number between 0 and 23' });
  }
  if (start_hour !== undefined && end_hour !== undefined && start_hour >= end_hour) {
    return res.status(400).json({ error: 'start_hour must be less than end_hour' });
  }
  if (days_ahead !== undefined && (typeof days_ahead !== 'number' || days_ahead < 1 || days_ahead > 90)) {
    return res.status(400).json({ error: 'days_ahead must be a number between 1 and 90' });
  }

  try {
    let settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE user_id = ?',
      [req.user!.id]
    );

    if (!settings) {
      // Create new settings with a share token
      const shareToken = crypto.randomBytes(16).toString('hex');
      await run(
        `INSERT INTO availability_settings (user_id, enabled, start_hour, end_hour, share_token, days_ahead)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user!.id,
          enabled !== undefined ? (enabled ? 1 : 0) : 0,
          start_hour !== undefined ? start_hour : 8,
          end_hour !== undefined ? end_hour : 17,
          shareToken,
          days_ahead !== undefined ? days_ahead : 14,
        ]
      );
    } else {
      // Update existing settings
      const updates: string[] = [];
      const params: any[] = [];

      if (enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(enabled ? 1 : 0);
      }
      if (start_hour !== undefined) {
        updates.push('start_hour = ?');
        params.push(start_hour);
      }
      if (end_hour !== undefined) {
        updates.push('end_hour = ?');
        params.push(end_hour);
      }
      if (days_ahead !== undefined) {
        updates.push('days_ahead = ?');
        params.push(days_ahead);
      }

      if (updates.length > 0) {
        updates.push('updated_at = datetime("now")');
        params.push(req.user!.id);
        await run(
          `UPDATE availability_settings SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      }
    }

    // Get updated settings
    settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE user_id = ?',
      [req.user!.id]
    );

    res.json(settings);
  } catch (error) {
    console.error('Update availability settings error:', error);
    res.status(500).json({ error: 'Failed to update availability settings' });
  }
});

// POST /api/availability/regenerate-token - Generate a new share token
router.post('/regenerate-token', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const shareToken = crypto.randomBytes(16).toString('hex');

    let settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE user_id = ?',
      [req.user!.id]
    );

    if (!settings) {
      await run(
        `INSERT INTO availability_settings (user_id, share_token) VALUES (?, ?)`,
        [req.user!.id, shareToken]
      );
    } else {
      await run(
        'UPDATE availability_settings SET share_token = ?, updated_at = datetime("now") WHERE user_id = ?',
        [shareToken, req.user!.id]
      );
    }

    settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE user_id = ?',
      [req.user!.id]
    );

    res.json(settings);
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ error: 'Failed to regenerate share token' });
  }
});

// Public route to view availability
interface TimeSlot {
  start: string;
  end: string;
  status: 'free' | 'busy';
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

// GET /api/availability/public/:token - Public availability view (no auth required)
router.get('/public/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // Find settings by share token
    const settings = await queryOne<AvailabilitySettings>(
      'SELECT * FROM availability_settings WHERE share_token = ? AND enabled = 1',
      [token]
    );

    if (!settings) {
      return res.status(404).json({ error: 'Availability not found or not enabled' });
    }

    // Get user's events for the next N days
    const todayStr = getToday();
    const startOfToday = new Date(todayStr + 'T00:00:00');
    const endDate = new Date(startOfToday.getTime() + settings.days_ahead * 24 * 60 * 60 * 1000);

    // Get all calendar sources for this user
    const sources = await query<CalendarSource>(
      'SELECT id FROM calendar_sources WHERE user_id = ?',
      [settings.user_id]
    );
    const sourceIds = sources.map(s => s.id);

    if (sourceIds.length === 0) {
      // No sources, return all free time
      const availability = generateAvailability(settings, startOfToday, endDate, []);
      return res.json({
        start_hour: settings.start_hour,
        end_hour: settings.end_hour,
        days: availability,
      });
    }

    // Get events within the date range
    const events = await query<Event>(
      `SELECT * FROM events
       WHERE source_id IN (${sourceIds.map(() => '?').join(',')})
       AND start_time >= ? AND start_time <= ?
       ORDER BY start_time ASC`,
      [...sourceIds, startOfToday.toISOString(), endDate.toISOString()]
    );

    // Generate availability with busy slots
    const availability = generateAvailability(settings, startOfToday, endDate, events);

    res.json({
      start_hour: settings.start_hour,
      end_hour: settings.end_hour,
      days: availability,
    });
  } catch (error) {
    console.error('Get public availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

function generateAvailability(
  settings: AvailabilitySettings,
  startDate: Date,
  endDate: Date,
  events: Event[]
): DayAvailability[] {
  const days: DayAvailability[] = [];
  const currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const slots = generateDaySlots(settings, currentDate, events);
    days.push({ date: dateStr, slots });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

function generateDaySlots(
  settings: AvailabilitySettings,
  date: Date,
  events: Event[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayStart = new Date(date);
  dayStart.setHours(settings.start_hour, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(settings.end_hour, 0, 0, 0);

  // Filter events for this day
  const dayEvents = events.filter(event => {
    const eventStart = new Date(event.start_time);
    const eventEnd = event.end_time ? new Date(event.end_time) : new Date(eventStart.getTime() + 60 * 60 * 1000);

    // Check if event overlaps with this day's working hours
    return eventStart < dayEnd && eventEnd > dayStart &&
           eventStart.toISOString().split('T')[0] === date.toISOString().split('T')[0];
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Generate 30-minute slots
  let currentTime = new Date(dayStart);

  while (currentTime < dayEnd) {
    const slotStart = new Date(currentTime);
    const slotEnd = new Date(currentTime.getTime() + 30 * 60 * 1000);

    // Check if this slot overlaps with any event
    const isBusy = dayEvents.some(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = event.end_time ? new Date(event.end_time) : new Date(eventStart.getTime() + 60 * 60 * 1000);
      return slotStart < eventEnd && slotEnd > eventStart;
    });

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      status: isBusy ? 'busy' : 'free',
    });

    currentTime = slotEnd;
  }

  return slots;
}

export default router;
