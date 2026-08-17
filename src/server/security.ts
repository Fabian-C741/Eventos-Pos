import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const test = scryptSync(password, salt, KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return test.length === expected.length && timingSafeEqual(test, expected);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function safePin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function sanitizeInput(value: string, maxLen = 200): string {
  return String(value ?? '').trim().slice(0, maxLen);
}