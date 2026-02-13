import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { initDatabase } from './database';
import { authentikAutoLogin } from './middleware/auth';
import authRoutes from './routes/auth';
import keysRoutes from './routes/keys';
import sourcesRoutes from './routes/sources';
import eventsRoutes from './routes/events';
import agendaRoutes from './routes/agenda';
import availabilityRoutes from './routes/availability';
import calendarColorsRoutes from './routes/calendar-colors';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(authentikAutoLogin);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/calendar-colors', calendarColorsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/health', healthRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));

  // Handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`DateStack server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
