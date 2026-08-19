import { BadRequest } from '../errors';
import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest, asyncHandler } from '../auth';
import { createSale, listSales, getSaleDetail, voidSale, lastSalesForBox, getOperationNumber } from '../services/sales.service';
import { getBox } from '../services/boxes.service';
import { assertEventAccess, getEvent, listEvents } from '../services/events.service';
import { parseNumber, parseOptionalInt } from './helpers';
import type { PaymentMethod } from '../../shared/types';

const router = Router();
router.use(requireAuth);

async function validateEventAccess(req: AuthedRequest, eventId: number) {
  await assertEventAccess(req.user!, eventId);
  const ev = await getEvent(eventId);
  if (!ev) throw BadRequest('Evento no encontrado');
  if (ev.active !== 1) {
    throw Object.assign(new Error('El evento está inactivo'), { friendly: 'El evento está inactivo. No se pueden registrar ventas.' });
  }
  return ev;
}

router.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const eventId = parseNumber(req.body.event_id);
    await validateEventAccess(req, eventId);
    const boxId = req.body.box_id ? parseNumber(req.body.box_id) : null;
    if (boxId) {
      const box = await getBox(boxId);
      if (!box) throw BadRequest('Caja no encontrada');
    }
    const payment = req.body.payment_method as PaymentMethod;
    const result = await createSale({
      event_id: eventId,
      box_id: boxId,
      user_id: req.user!.id,
      items: Array.isArray(req.body.items) ? req.body.items : [],
      tickets: Array.isArray(req.body.tickets) ? req.body.tickets : [],
      payment_method: payment,
      device: req.device,
    });
    res.json(result);
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
    const tid = req.user!.role === 'admin' ? req.user!.id : req.user!.owner_id ?? null;
    if (tid === null) {
      res.json([]);
      return;
    }
    const rows = await listEvents(req.user!);
    eventIds = rows.map((r) => r.id);
    if (eventIds.length === 0) {
      res.json([]);
      return;
    }
  }
  const sales = await listSales({
    event_id: eventId,
    event_ids: eventIds,
    box_id: parseOptionalInt(q.box_id),
    user_id: parseOptionalInt(q.user_id),
    payment_method: q.payment_method,
    status: (q.status as 'activa' | 'anulada') || undefined,
    from: q.from,
    to: q.to,
    limit: parseOptionalInt(q.limit) ?? 200,
    offset: parseOptionalInt(q.offset) ?? 0,
  });
  res.json(sales);
}));

router.get('/operation', async (req: AuthedRequest, res, next) => {
  try {
    const eventId = parseNumber(req.query.event_id);
    await assertEventAccess(req.user!, eventId);
    const op = await getOperationNumber(eventId);
    res.json({ operation_number: op });
  } catch (e) {
    next(e);
  }
});

router.get('/box/:boxId/recent', async (req: AuthedRequest, res, next) => {
  try {
    const box = await getBox(parseNumber(req.params.boxId));
    if (!box) throw BadRequest('Caja no encontrada');
    await assertEventAccess(req.user!, box.event_id);
    res.json(await lastSalesForBox(parseNumber(req.params.boxId)));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const sale = await getSaleDetail(parseNumber(req.params.id));
    await assertEventAccess(req.user!, sale.event_id);
    res.json(sale);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/void', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const sale = await getSaleDetail(parseNumber(req.params.id));
    await assertEventAccess(req.user!, sale.event_id);
    const detail = await voidSale(parseNumber(req.params.id), req.user!.id, String(req.body.reason ?? ''), req.device);
    res.json(detail);
  } catch (e) {
    next(e);
  }
});

export default router;
