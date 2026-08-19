import { BadRequest } from '../errors';
import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest, asyncHandler } from '../auth';
import {
  openClose,
  currentOpenClose,
  computeCloseSummary,
  closeBox,
  listCloses,
  ensureOpenClose,
} from '../services/closes.service';
import { getBox } from '../services/boxes.service';
import { getEvent } from '../services/events.service';
import { parseNumber, parseOptionalInt } from './helpers';
import type { PaymentMethod } from '../../shared/types';

const router = Router();
router.use(requireAuth);

router.post('/open', async (req: AuthedRequest, res, next) => {
  try {
    const eventId = parseNumber(req.body.event_id);
    const boxId = parseNumber(req.body.box_id);
    const ev = await getEvent(eventId);
    const box = await getBox(boxId);
    if (!ev) throw BadRequest('Evento no encontrado');
    if (!box) throw BadRequest('Caja no encontrada');
    res.json(await openClose(eventId, boxId, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.get('/box/:boxId/current', async (req, res, next) => {
  try {
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
    const close = await ensureOpenClose(eventId, boxId, req.user!.id);
    res.json(close);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/summary', async (req, res, next) => {
  try {
    res.json(await computeCloseSummary(parseNumber(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/close', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const declared = req.body.declared_by_payment as Partial<Record<PaymentMethod, number>>;
    if (!declared || typeof declared !== 'object') {
      res.status(400).json({ error: 'Datos de cierre inválidos' });
      return;
    }
    const close = await closeBox(parseNumber(req.params.id), req.user!.id, {
      efectivo: Number(declared.efectivo ?? 0),
      transferencia: Number(declared.transferencia ?? 0),
      tarjeta: Number(declared.tarjeta ?? 0),
      otro: Number(declared.otro ?? 0),
    });
    res.json(close);
  } catch (e) {
    next(e);
  }
});

router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await listCloses({
      event_id: parseOptionalInt(q.event_id),
      box_id: parseOptionalInt(q.box_id),
      status: q.status,
    }),
  );
}));

export default router;
