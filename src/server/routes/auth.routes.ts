import { Router } from 'express';
import {
  createSuperadmin,
  login,
  loginPin,
  logout,
  needsSetup,
  changeOwnPassword,
} from '../services/auth.service';
import { sanitizeInput } from '../security';
import { audit } from '../services/audit.service';
import { requireAuth, attachDevice, AuthedRequest, asyncHandler } from '../auth';
import { logger } from '../logger';
import { initSequenceCounters } from '../services/auth.service';

const router = Router();

router.get('/status', asyncHandler(async (_req, res) => {
  res.json({ setup: await needsSetup() });
}));

router.post('/setup', async (req, res, next) => {
  try {
    if (!(await needsSetup())) {
      res.status(400).json({ error: 'El sistema ya está configurado', code: 'VALIDATION' });
      return;
    }
    await createSuperadmin(
      sanitizeInput(req.body.email, 100),
      String(req.body.password ?? ''),
      sanitizeInput(req.body.name, 100),
    );
    logger.info('auth', 'Setup completado');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const device = attachDevice(req);
    const { token, user } = await login(
      sanitizeInput(req.body.username, 100),
      String(req.body.password ?? ''),
      device,
    );
    await audit(user.id, 'login', 'session', null, { device });
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/login/pin', async (req, res, next) => {
  try {
    const device = attachDevice(req);
    const { token, user } = await loginPin(
      sanitizeInput(req.body.username, 100),
      String(req.body.pin ?? ''),
      device,
    );
    await audit(user.id, 'login_pin', 'session', null, { device });
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  await logout(token);
  res.json({ ok: true });
}));

router.post('/change-password', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await changeOwnPassword(req.user!.id, String(req.body.current ?? ''), String(req.body.next ?? ''));
    await audit(req.user!.id, 'change_password', 'user', req.user!.id, {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/init-sequences', requireAuth, asyncHandler(async (_req: AuthedRequest, res) => {
  await initSequenceCounters();
  res.json({ ok: true });
}));

export default router;
