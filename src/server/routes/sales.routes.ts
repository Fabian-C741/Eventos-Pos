import { BadRequest } from '../errors';
import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest, asyncHandler } from '../auth';
import { createSale, listSales, getSaleDetail, voidSale, lastSalesForBox, getOperationNumber } from '../services/sales.service';
import { getBox } from '../services/boxes.service';
import { getEvent } from '../services/events.service';
import { parseNumber, parseOptionalInt } from './helpers';
import type { PaymentMethod } from '../../shared/types';

const router = Router();
router.use(requireAuth);

async function validateEventAccess(eventId: number) {
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
    await validateEventAccess(eventId);
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
  const sales = await listSales({
    event_id: parseOptionalInt(q.event_id),
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
    const op = await getOperationNumber(parseNumber(req.query.event_id));
    res.json({ operation_number: op });
  } catch (e) {
    next(e);
  }
});

router.get('/box/:boxId/recent', async (req, res, next) => {
  try {
    res.json(await lastSalesForBox(parseNumber(req.params.boxId)));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getSaleDetail(parseNumber(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/void', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const detail = await voidSale(parseNumber(req.params.id), req.user!.id, String(req.body.reason ?? ''), req.device);
    res.json(detail);
  } catch (e) {
    next(e);
  }
});

export default router;
