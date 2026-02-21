import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { queryOne, query, run, User, ApiKey } from '../database';

// In production, SECRET_KEY must be explicitly set to prevent JWT forgery
if (process.env.NODE_ENV === 'production' && !process.env.SECRET_KEY) {
  throw new Error('FATAL: SECRET_KEY environment variable must be set in production. Refusing to start with default key.');
}
const SECRET_KEY = process.env.SECRET_KEY || 'development-secret-key';

export interface AuthRequest extends Request {
  user?: User;
}

// Verify JWT token from cookie or Authorization header
export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: number; type: string };
    if (decoded.type !== 'access') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// BUG-010 FIX: Short-lived access tokens with refresh token rotation
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Generate short-lived access token (15 minutes by default)
export function generateToken(userId: number): string {
  return jwt.sign({ userId, type: 'access' }, SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRY as any });
}

// Generate long-lived refresh token (7 days by default)
export function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: 'refresh' }, SECRET_KEY, { expiresIn: REFRESH_TOKEN_EXPIRY as any });
}

// Verify refresh token specifically
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: number; type: string };
    if (decoded.type !== 'refresh') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// Helper: Standard cookie options for access token
export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  };
}

// Helper: Standard cookie options for refresh token
export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

// Middleware: Require JWT authentication (for web frontend)
// BUG-010 FIX: Supports automatic token refresh when access token expires
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
    // No access token — try to auto-refresh using refresh token
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const refreshDecoded = verifyRefreshToken(refreshToken);
      if (refreshDecoded) {
        return queryOne<User>('SELECT * FROM users WHERE id = ?', [refreshDecoded.userId]).then(user => {
          if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
          }
          // Issue new token pair (rotation)
          const newAccessToken = generateToken(user.id);
          const newRefreshToken = generateRefreshToken(user.id);
          res.cookie('token', newAccessToken, getAccessCookieOptions());
          res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());
          req.user = user;
          next();
        }).catch(() => {
          res.status(401).json({ error: 'Authentication required' });
        });
      }
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    // Access token expired — try refresh
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const refreshDecoded = verifyRefreshToken(refreshToken);
      if (refreshDecoded) {
        return queryOne<User>('SELECT * FROM users WHERE id = ?', [refreshDecoded.userId]).then(user => {
          if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
          }
          // Rotate tokens
          const newAccessToken = generateToken(user.id);
          const newRefreshToken = generateRefreshToken(user.id);
          res.cookie('token', newAccessToken, getAccessCookieOptions());
          res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());
          req.user = user;
          next();
        }).catch(() => {
          res.status(401).json({ error: 'Authentication failed' });
        });
      }
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  queryOne<User>('SELECT * FROM users WHERE id = ?', [decoded.userId]).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Authentication failed' });
  });
}

// Middleware: Require API key authentication (for client sync)
export function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  queryOne<ApiKey>('SELECT * FROM api_keys WHERE key = ?', [apiKey]).then(keyRecord => {
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    queryOne<User>('SELECT * FROM users WHERE id = ?', [keyRecord.user_id]).then(user => {
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      req.user = user;
      next();
    }).catch(() => {
      res.status(500).json({ error: 'Authentication failed' });
    });
  }).catch(() => {
    res.status(500).json({ error: 'Authentication failed' });
  });
}

// Middleware: Accept either JWT or API key
export function requireAnyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Try API key first
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    queryOne<ApiKey>('SELECT * FROM api_keys WHERE key = ?', [apiKey]).then(keyRecord => {
      if (keyRecord) {
        queryOne<User>('SELECT * FROM users WHERE id = ?', [keyRecord.user_id]).then(user => {
          if (user) {
            req.user = user;
            return next();
          }
          tryJwt();
        }).catch(() => tryJwt());
      } else {
        tryJwt();
      }
    }).catch(() => tryJwt());
    return;
  }

  tryJwt();

  function tryJwt() {
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
        queryOne<User>('SELECT * FROM users WHERE id = ?', [decoded.userId]).then(user => {
          if (user) {
            req.user = user;
            return next();
          }
          res.status(401).json({ error: 'Authentication required' });
        }).catch(() => {
          res.status(500).json({ error: 'Authentication failed' });
        });
        return;
      }
    }

    res.status(401).json({ error: 'Authentication required' });
  }
}

// Middleware: Require admin
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware: Require system API key (for system-level operations)
export function requireSystemKey(req: Request, res: Response, next: NextFunction) {
  const systemKey = process.env.SYSTEM_API_KEY;
  if (!systemKey) {
    return res.status(503).json({ error: 'System API key not configured' });
  }

  const providedKey = req.headers['x-system-key'] as string;
  if (!providedKey || providedKey !== systemKey) {
    return res.status(401).json({ error: 'Invalid system key' });
  }

  next();
}

// Middleware: Authentik forward auth auto-login
// When placed early in the middleware chain, this checks for Authentik headers
// (X-authentik-email, X-authentik-username, X-authentik-name) passed by the
// reverse proxy after Authentik forward auth. If present and no valid JWT cookie
// exists, it auto-creates the user in the database and sets the JWT cookie.
// This is transparent — if no Authentik headers are present, it does nothing
// and the normal login flow works as usual.
//
// SECURITY: AUTHENTIK_ENABLED must be explicitly set to 'true' for this middleware
// to process headers. If the app is exposed directly (not behind a trusted reverse
// proxy), attackers could spoof X-authentik-* headers to authenticate as any user.
export function authentikAutoLogin(req: AuthRequest, res: Response, next: NextFunction) {
  // BUG-003 FIX: Only trust Authentik headers when explicitly enabled
  const authentikEnabled = process.env.AUTHENTIK_ENABLED === 'true';
  if (!authentikEnabled) {
    return next();
  }

  const authentikEmail = req.headers['x-authentik-email'] as string;
  if (!authentikEmail) {
    return next();
  }

  // If user already has a valid JWT cookie, skip auto-login
  const existingToken = req.cookies?.token;
  if (existingToken) {
    const decoded = verifyToken(existingToken);
    if (decoded) {
      return next();
    }
  }

  // Auto-create or find the user, then set JWT cookie
  queryOne<User>('SELECT * FROM users WHERE email = ?', [authentikEmail])
    .then(async (user) => {
      if (!user) {
        // Generate a random password hash (user will never use it — auth is via Authentik)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        // Check if this is the first user (auto-promote to admin)
        // Uses same pattern as routes/auth.ts register endpoint
        const existingUsers = await query<{ id: number }>('SELECT id FROM users LIMIT 1', []);
        const isFirst = existingUsers.length === 0;

        await run(
          'INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, ?)',
          [authentikEmail, passwordHash, isFirst ? 1 : 0]
        );
        user = await queryOne<User>('SELECT * FROM users WHERE email = ?', [authentikEmail]);
      }

      if (user) {
        // BUG-010 FIX: Set both access and refresh tokens
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        res.cookie('token', token, getAccessCookieOptions());
        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
      }
      next();
    })
    .catch((err) => {
      console.error('Authentik auto-login error:', err);
      next();
    });
}
