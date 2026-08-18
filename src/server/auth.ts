import { NextFunction, Request, Response } from 'express';
import { validateSession } from './services/auth.service';
import type { Role, User } from '../shared/types';
import { logger } from './logger';

export interface AuthedRequest extends Request {
  user?: User;
  device?: string;
}

export function attachDevice(req: Request) {
  const viaHeader = (req.headers['x-device'] as string) || '';
  const viaUserAgent = req.headers['user-agent'] || '';
  return (viaHeader || viaUserAgent).slice(0, 120);
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await validateSession(token);
    if (!user) {
      res.status(401).json({ error: 'Sesión inválida o expirada', code: 'UNAUTHORIZED' });
      return;
    }
    req.user = user;
    req.device = attachDevice(req);
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado', code: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'No tenés permisos para esta acción', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export function errorHandler(err: unknown, req: AuthedRequest, res: Response, _next: NextFunction) {
  const friendly = (err as { friendly?: string })?.friendly;
  const statusCode = (err as { statusCode?: number })?.statusCode;
  const message = (err as { message?: string })?.message || 'Error interno del servidor';
  const stack = (err as { stack?: string })?.stack;
  logger.error('api', message, { stack: stack?.slice(0, 1000) }, req.user?.id, req.device);
  if (statusCode && statusCode < 500) {
    res.status(statusCode).json({ error: message, code: 'VALIDATION' });
  } else if (friendly) {
    res.status(400).json({ error: friendly, code: 'VALIDATION' });
  } else {
    res.status(500).json({ error: message, code: 'SERVER_ERROR' });
  }
}

export function asyncHandler(fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}