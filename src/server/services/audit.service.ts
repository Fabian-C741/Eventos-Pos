import { exec } from '../db/db';

export function audit(userId: number | null, action: string, entity: string, entityId: number | null, details?: unknown) {
  try {
    exec(
      'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      userId,
      action,
      entity,
      entityId,
      details !== undefined ? JSON.stringify(details) : null,
    );
  } catch {
    /* noop */
  }
}