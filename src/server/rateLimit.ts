import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, Bucket>();

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  if (timer.unref) timer.unref();

  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({ error: 'Demasiadas solicitudes. Esperá e intentá de nuevo.', code: 'RATE_LIMIT' });
      return;
    }

    next();
  };
}

export const rateLimitGeneral = createLimiter(60_000, 100);
export const rateLimitAuth = createLimiter(60_000, 10);
export const rateLimitSales = createLimiter(60_000, 30);
