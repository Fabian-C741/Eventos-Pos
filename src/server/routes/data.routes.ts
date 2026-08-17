import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../auth';
import * as eventsSvc from '../services/events.service';
import * as catsSvc from '../services/categories.service';
import * as prodSvc from '../services/products.service';
import * as ticketsSvc from '../services/tickets.service';
import * as boxesSvc from '../services/boxes.service';
import * as usersSvc from '../services/auth.service';
import { parseNumber } from './helpers';

const router = Router();
router.use(requireAuth);

// ----- Users (superadmin: admins; superadmin/admin: cajeros) -----
router.get('/users', requireRole('superadmin', 'admin'), (_req, res) => {
  res.json(usersSvc.listUsers());
});

router.post('/users', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    const { username, name, role, password, pin } = req.body;
    if (req.user!.role !== 'superadmin' && role !== 'cajero') {
      res.status(403).json({ error: 'Solo el superadministrador puede crear administradores', code: 'FORBIDDEN' });
      return;
    }
    const id = usersSvc.createUser({ username, name, role, password, pin }, req.user!.role);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.put('/users/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    const id = parseNumber(req.params.id);
    usersSvc.updateUser(id, req.body, req.user!.role, req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/users/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    const id = parseNumber(req.params.id);
    const result = usersSvc.deleteUser(id, req.user!.role, req.user!.id);
    res.json({ result });
  } catch (e) {
    next(e);
  }
});

// ----- Events -----
router.get('/events', (_req, res) => {
  res.json(eventsSvc.listEvents());
});

router.get('/events/:id', (req, res, next) => {
  try {
    const ev = eventsSvc.getEvent(parseNumber(req.params.id));
    if (!ev) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.post('/events', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    const ev = eventsSvc.createEvent(req.body, req.user!.id);
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.put('/events/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    const ev = eventsSvc.updateEvent(parseNumber(req.params.id), req.body, req.user!.id);
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.delete('/events/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    eventsSvc.deleteEvent(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Categories -----
router.get('/events/:eventId/categories', (req, res) => {
  res.json(catsSvc.listCategories(parseNumber(req.params.eventId)));
});

router.post('/events/:eventId/categories', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(catsSvc.createCategory(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/categories/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(catsSvc.updateCategory(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/categories/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    catsSvc.deleteCategory(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Products -----
router.get('/events/:eventId/products', (req, res) => {
  res.json(prodSvc.listProducts(parseNumber(req.params.eventId)));
});

router.post('/events/:eventId/products', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(prodSvc.createProduct(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/products/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(prodSvc.updateProduct(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post('/products/:id/duplicate', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(prodSvc.duplicateProduct(parseNumber(req.params.id), req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/products/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    prodSvc.deleteProduct(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Ticket types -----
router.get('/events/:eventId/tickets', (req, res) => {
  res.json(ticketsSvc.listTicketTypes(parseNumber(req.params.eventId)));
});

router.post('/events/:eventId/tickets', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(ticketsSvc.createTicketType(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/tickets/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(ticketsSvc.updateTicketType(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/tickets/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    ticketsSvc.deleteTicketType(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/events/:eventId/tickets/last-numbers', (req, res) => {
  res.json(ticketsSvc.lastTicketNumbers(parseNumber(req.params.eventId)));
});

// ----- Boxes -----
router.get('/events/:eventId/boxes', (req, res) => {
  res.json(boxesSvc.listBoxes(parseNumber(req.params.eventId)));
});

router.post('/events/:eventId/boxes', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(boxesSvc.createBox(parseNumber(req.params.eventId), req.body.name ?? '', req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/boxes/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    res.json(boxesSvc.updateBox(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/boxes/:id', requireRole('superadmin', 'admin'), (req: AuthedRequest, res, next) => {
  try {
    boxesSvc.deleteBox(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;