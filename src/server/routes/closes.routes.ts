import { BadRequest } from '../errors';
import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest, asyncHandler } from '../auth';
import { getRow } from '../db/db';
import {
  openClose,
  currentOpenClose,
  computeCloseSummary,
  closeBox,
  listCloses,
  ensureOpenClose,
} from '../services/closes.service';
import { getBox } from '../services/boxes.service';
import { assertEventAccess, getEvent, listEvents } from '../services/events.service';
import { parseNumber, parseOptionalInt } from './helpers';
import type { PaymentMethod } from '../../shared/types';

const router = Router();
router.use(requireAuth);

router.post('/open', async (req: AuthedRequest, res, next) => {
  try {
    const eventId = parseNumber(req.body.event_id);
    const boxId = parseNumber(req.body.box_id);
    await assertEventAccess(req.user!, eventId);
    const ev = await getEvent(eventId);
    const box = await getBox(boxId);
    if (!ev) throw BadRequest('Evento no encontrado');
    if (!box) throw BadRequest('Caja no encontrada');
    res.json(await openClose(eventId, boxId, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.get('/box/:boxId/current', async (req: AuthedRequest, res, next) => {
  try {
    const box = await getBox(parseNumber(req.params.boxId));
    if (!box) throw BadRequest('Caja no encontrada');
    await assertEventAccess(req.user!, box.event_id);
    const close = await currentOpenClose(parseNumber(req.params.boxId));
    if (!close) {
      res.json(null);
      return;
    }
    res.json({ close, summary: await computeCloseSummary(close.id) });
  } catch (e) {
    next(e);
  }
});

router.post('/box/:boxId/ensure', async (req: AuthedRequest, res, next) => {
  try {
    const boxId = parseNumber(req.params.boxId);
    const eventId = parseNumber(req.body.event_id);
    await assertEventAccess(req.user!, eventId);
    const close = await ensureOpenClose(eventId, boxId, req.user!.id);
    res.json(close);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/summary', async (req: AuthedRequest, res, next) => {
  try {
    const close = await getRow<{ event_id: number }>('SELECT event_id FROM closes WHERE id = ?', parseNumber(req.params.id));
    if (!close) throw BadRequest('Cierre no encontrado');
    await assertEventAccess(req.user!, close.event_id);
    res.json(await computeCloseSummary(parseNumber(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/close', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const close = await getRow<{ event_id: number }>('SELECT event_id FROM closes WHERE id = ?', parseNumber(req.params.id));
    if (!close) throw BadRequest('Cierre no encontrado');
    await assertEventAccess(req.user!, close.event_id);
    const declared = req.body.declared_by_payment as Partial<Record<PaymentMethod, number>>;
    if (!declared || typeof declared !== 'object') {
      res.status(400).json({ error: 'Datos de cierre inválidos' });
      return;
    }
    const closed = await closeBox(parseNumber(req.params.id), req.user!.id, {
      efectivo: Number(declared.efectivo ?? 0),
      transferencia: Number(declared.transferencia ?? 0),
      tarjeta: Number(declared.tarjeta ?? 0),
      otro: Number(declared.otro ?? 0),
    });
    res.json(closed);
  } catch (e) {
    next(e);
  }
});

router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  const eventId = parseOptionalInt(q.event_id);
  if (eventId) {
    await assertEventAccess(req.user!, eventId);
  }
  let eventIds: number[] | undefined;
  if (!eventId && req.user!.role !== 'superadmin') {
    const rows = await listEvents(req.user!);
    eventIds = rows.map((r) => r.id);
    if (eventIds.length === 0) {
      res.json([]);
      return;
    }
  }
  res.json(
    await listCloses({
      event_id: eventId,
      event_ids: eventIds,
      box_id: parseOptionalInt(q.box_id),
      status: q.status,
    }),
  );
}));

export default router;
