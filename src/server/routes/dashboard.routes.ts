import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../auth';
import { dashboard, stats } from '../services/dashboard.service';
import { getReport } from '../services/reports.service';
import { parseOptionalInt } from './helpers';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await dashboard(
      parseOptionalInt(q.event_id),
      q.from,
      q.to,
    ),
  );
});

router.get('/stats', async (req: AuthedRequest, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await stats(
      parseOptionalInt(q.event_id),
      q.from,
      q.to,
    ),
  );
});

router.get('/reports/:type', async (req: AuthedRequest, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const result = await getReport(req.params.type, {
      event_id: parseOptionalInt(q.event_id),
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