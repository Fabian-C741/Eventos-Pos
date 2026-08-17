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
import { requireAuth, attachDevice, AuthedRequest } from '../auth';
import { logger } from '../logger';
import { initSequenceCounters } from '../services/auth.service';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ setup: needsSetup() });
});

router.post('/setup', (req, res, next) => {
  try {
    if (!needsSetup()) {
      res.status(400).json({ error: 'El sistema ya está configurado', code: 'VALIDATION' });
      return;
    }
    createSuperadmin(
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

router.post('/login', (req, res, next) => {
  try {
    const device = attachDevice(req);
    const { token, user } = login(
      sanitizeInput(req.body.username, 100),
      String(req.body.password ?? ''),
      device,
    );
    audit(user.id, 'login', 'session', null, { device });
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/login/pin', (req, res, next) => {
  try {
    const device = attachDevice(req);
    const { token, user } = loginPin(
      sanitizeInput(req.body.username, 100),
      String(req.body.pin ?? ''),
      device,
    );
    audit(user.id, 'login_pin', 'session', null, { device });
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', requireAuth, (req: AuthedRequest, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  logout(token);
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, (req: AuthedRequest, res, next) => {
  try {
    changeOwnPassword(req.user!.id, String(req.body.current ?? ''), String(req.body.next ?? ''));
    audit(req.user!.id, 'change_password', 'user', req.user!.id, {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/init-sequences', requireAuth, (_req: AuthedRequest, res) => {
  initSequenceCounters();
  res.json({ ok: true });
});

export default router;