import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, queryOne, User, ApiKey } from '../database';

const SECRET_KEY = process.env.SECRET_KEY || 'development-secret-key';

export interface AuthRequest extends Request {
  user?: User;
}

// Verify JWT token from cookie or Authorization header
export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: number };
    return decoded;
  } catch {
    return null;
  }
}

// Generate JWT token
export function generateToken(userId: number): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, SECRET_KEY, { expiresIn: expiresIn as any });
}

// Middleware: Require JWT authentication (for web frontend)
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Check cookie first
  let token = req.cookies?.token;

  // Then check Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [decoded.userId]);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

// Middleware: Require API key authentication (for client sync)
export function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const keyRecord = queryOne<ApiKey>('SELECT * FROM api_keys WHERE key = ?', [apiKey]);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [keyRecord.user_id]);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

// Middleware: Accept either JWT or API key
export function requireAnyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Try API key first
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const keyRecord = queryOne<ApiKey>('SELECT * FROM api_keys WHERE key = ?', [apiKey]);
    if (keyRecord) {
      const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [keyRecord.user_id]);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  // Fall back to JWT
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [decoded.userId]);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}
