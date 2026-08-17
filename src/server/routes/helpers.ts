import { BadRequest } from '../errors';
export function parseNumber(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) throw BadRequest('Valor numérico inválido');
  return n;
}

export function parseOptionalInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}