import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest, asyncHandler } from '../auth';
import * as eventsSvc from '../services/events.service';
import * as catsSvc from '../services/categories.service';
import * as prodSvc from '../services/products.service';
import * as ticketsSvc from '../services/tickets.service';
import * as boxesSvc from '../services/boxes.service';
import * as usersSvc from '../services/auth.service';
import { NotFound } from '../errors';
import { parseNumber } from './helpers';

const router = Router();
router.use(requireAuth);

async function gateEvent(req: AuthedRequest, eventId: number) {
  await eventsSvc.assertEventAccess(req.user!, eventId);
}

async function gateEntity<T extends { event_id: number }>(req: AuthedRequest, id: number, getter: (id: number) => Promise<T | undefined>) {
  const entity = await getter(id);
  if (!entity) throw NotFound('No encontrado');
  await eventsSvc.assertEventAccess(req.user!, entity.event_id);
}

// ----- Users (superadmin: admins; superadmin/admin: cajeros) -----
router.get('/users', requireRole('superadmin', 'admin'), asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await usersSvc.listUsers(req.user!));
}));

router.post('/users', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const { username, name, role, password, pin, pos_categories, pos_tickets, pos_box_id, owner_id } = req.body;
    if (req.user!.role !== 'superadmin' && role !== 'cajero') {
      res.status(403).json({ error: 'Solo el superadministrador puede crear administradores', code: 'FORBIDDEN' });
      return;
    }
    const id = await usersSvc.createUser({ username, name, role, password, pin, pos_categories, pos_tickets, pos_box_id, owner_id }, req.user!);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.put('/users/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const id = parseNumber(req.params.id);
    await usersSvc.updateUser(id, req.body, req.user!);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/users/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const id = parseNumber(req.params.id);
    const result = await usersSvc.deleteUser(id, req.user!);
    res.json({ result });
  } catch (e) {
    next(e);
  }
});

// ----- Events -----
router.get('/events', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await eventsSvc.listEvents(req.user!));
}));

router.get('/events/:id', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.id));
    const ev = await eventsSvc.getEvent(parseNumber(req.params.id));
    if (!ev) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.post('/events', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    const ev = await eventsSvc.createEvent(req.body, req.user!);
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.put('/events/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.id));
    const ev = await eventsSvc.updateEvent(parseNumber(req.params.id), req.body, req.user!);
    res.json(ev);
  } catch (e) {
    next(e);
  }
});

router.delete('/events/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await eventsSvc.deleteEvent(parseNumber(req.params.id), req.user!);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Categories -----
router.get('/events/:eventId/categories', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await catsSvc.listCategories(parseNumber(req.params.eventId)));
  } catch (e) {
    next(e);
  }
});

router.post('/events/:eventId/categories', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await catsSvc.createCategory(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/categories/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), catsSvc.getCategory);
    res.json(await catsSvc.updateCategory(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/categories/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), catsSvc.getCategory);
    await catsSvc.deleteCategory(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Products -----
router.get('/events/:eventId/products', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await prodSvc.listProducts(parseNumber(req.params.eventId)));
  } catch (e) {
    next(e);
  }
});

router.post('/events/:eventId/products', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await prodSvc.createProduct(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/products/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), prodSvc.getProduct);
    res.json(await prodSvc.updateProduct(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.post('/products/:id/duplicate', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), prodSvc.getProduct);
    res.json(await prodSvc.duplicateProduct(parseNumber(req.params.id), req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/products/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), prodSvc.getProduct);
    await prodSvc.deleteProduct(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- Ticket types -----
router.get('/events/:eventId/tickets', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await ticketsSvc.listTicketTypes(parseNumber(req.params.eventId)));
  } catch (e) {
    next(e);
  }
});

router.post('/events/:eventId/tickets', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await ticketsSvc.createTicketType(parseNumber(req.params.eventId), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.put('/tickets/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), ticketsSvc.getTicketType);
    res.json(await ticketsSvc.updateTicketType(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/tickets/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), ticketsSvc.getTicketType);
    await ticketsSvc.deleteTicketType(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/events/:eventId/tickets/last-numbers', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await ticketsSvc.lastTicketNumbers(parseNumber(req.params.eventId)));
  } catch (e) {
    next(e);
  }
});

// ----- Boxes -----
router.get('/events/:eventId/boxes', async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    res.json(await boxesSvc.listBoxes(parseNumber(req.params.eventId)));
  } catch (e) {
    next(e);
  }
});

router.post('/events/:eventId/boxes', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEvent(req, parseNumber(req.params.eventId));
    const { name, pos_categories, pos_tickets } = req.body;
    res.json(await boxesSvc.createBox(parseNumber(req.params.eventId), { name, pos_categories, pos_tickets }, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.get('/boxes/:id', async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), boxesSvc.getBox);
    res.json(await boxesSvc.getBox(parseNumber(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.put('/boxes/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), boxesSvc.getBox);
    res.json(await boxesSvc.updateBox(parseNumber(req.params.id), req.body, req.user!.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/boxes/:id', requireRole('superadmin', 'admin'), async (req: AuthedRequest, res, next) => {
  try {
    await gateEntity(req, parseNumber(req.params.id), boxesSvc.getBox);
    await boxesSvc.deleteBox(parseNumber(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
