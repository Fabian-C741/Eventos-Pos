import { Router } from 'express';
import { requireAuth, AuthedRequest, asyncHandler } from '../auth';
import { dashboard, stats } from '../services/dashboard.service';
import { getReport } from '../services/reports.service';
import { assertEventAccess, listEvents } from '../services/events.service';
import { parseOptionalInt } from './helpers';

const router = Router();
router.use(requireAuth);

async function resolveEventScope(req: AuthedRequest, eventId: number | undefined): Promise<number | undefined> {
  if (eventId) {
    await assertEventAccess(req.user!, eventId);
    return eventId;
  }
  if (req.user!.role === 'superadmin') return undefined;
  const events = await listEvents(req.user!);
  return events[0]?.id;
}

router.get('/dashboard', asyncHandler(async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  const eventId = parseOptionalInt(q.event_id);
  const scope = await resolveEventScope(req, eventId);
  if (eventId === undefined && scope === undefined && req.user!.role !== 'superadmin') {
    res.json({ total_recaudado: 0, total_efectivo: 0, total_transferencia: 0, total_tarjeta: 0, total_otro: 0, total_ventas: 0, total_entradas: 0, total_boletas: 0, total_productos: 0, ventas_anuladas: 0, monto_anulado: 0 });
    return;
  }
  res.json(await dashboard(scope, q.from, q.to));
}));

router.get('/stats', asyncHandler(async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  const eventId = parseOptionalInt(q.event_id);
  const scope = await resolveEventScope(req, eventId);
  if (eventId === undefined && scope === undefined && req.user!.role !== 'superadmin') {
    res.json({ por_hora: [], por_dia: [], top_productos: [], por_categoria: [], por_cajero: [], por_caja: [], por_pago: [], por_tipo_ticket: [] });
    return;
  }
  res.json(await stats(scope, q.from, q.to));
}));

router.get('/reports/:type', async (req: AuthedRequest, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const eventId = parseOptionalInt(q.event_id);
    await assertEventAccess(req.user!, eventId ?? 0);
    const result = await getReport(req.params.type, {
      event_id: eventId,
      box_id: parseOptionalInt(q.box_id),
      user_id: parseOptionalInt(q.user_id),
      from: q.from,
      to: q.to,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;