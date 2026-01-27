import { Router } from 'express';
import { getDb } from '../database';

const router = Router();

// GET /health - Health check endpoint
router.get('/', (req, res) => {
  try {
    // Quick database check
    const db = getDb();
    db.exec('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

export default router;
