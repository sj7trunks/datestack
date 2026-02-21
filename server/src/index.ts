import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

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
// BUG-006 FIX: Reject wildcard '*' origin when credentials are enabled to prevent credential leakage
const rawCorsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000', 'http://localhost:5173'];
if (rawCorsOrigins.includes('*')) {
  console.error('FATAL: CORS_ORIGINS contains wildcard "*" which is incompatible with credentials:true. This could lead to credential leakage.');
  console.error('Please specify explicit origins instead (e.g., "http://localhost:3000,http://example.com").');
  process.exit(1);
}
const corsOrigins = rawCorsOrigins;
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers should use CSP instead
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middleware
app.use(express.json({ limit: '1mb' }));
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

  // Read index.html once and inject runtime config (Authentik logout URL, etc.)
  const indexHtml = fs.readFileSync(path.join(frontendPath, 'index.html'), 'utf-8');
  const authentikHost = process.env.AUTHENTIK_HOST;
  const runtimeConfig = authentikHost
    ? `<script>window.__AUTHENTIK_LOGOUT_URL__=${JSON.stringify(authentikHost.replace(/[<>"']/g, '') + "/if/flow/default-invalidation-flow/")};</script>`
    : '';
  const injectedHtml = indexHtml.replace('</head>', `${runtimeConfig}</head>`);

  // Handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
      res.set('Content-Type', 'text/html');
      res.send(injectedHtml);
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
