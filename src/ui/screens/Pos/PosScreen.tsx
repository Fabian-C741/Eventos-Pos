import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { api, flushQueue, hasPendingQueue, queueSale } from '../../api/client';
import { formatMoney, padNumber } from '../../../shared/format';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../../shared/constants';
import type { CartItem, CartTicket, Event, Box, TicketType, Sale } from '../../../shared/types';

interface PendingSale {
  op: number | null;
  total: number;
  method: string;
  offline: boolean;
}

export function PosScreen() {
  const { user, logout } = useAuth();
  const { events, activeEvent, setActiveEvent, categories, products, ticketTypes, boxes, refreshEventData } = useData();
  const { push } = useToast();
  const navigate = useNavigate();

  const [selectedCat, setSelectedCat] = useState<number | 'tickets'>('tickets');
  const [items, setItems] = useState<CartItem[]>([]);
  const [tickets, setTickets] = useState<CartTicket[]>([]);
  const [boxId, setBoxId] = useState<number | null>(null);
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketType, setTicketType] = useState<TicketType | null>(null);
  const [ticketQty, setTicketQty] = useState(1);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [pendingQueue, setPendingQueue] = useState(hasPendingQueue());
  const [clock, setClock] = useState(new Date());

  const saleSound = useRef<AudioContext | null>(null);

  const activeBoxes = useMemo(() => boxes.filter((b) => b.active === 1), [boxes]);
  const activeCategories = useMemo(() => categories.filter((c) => c.active === 1), [categories]);
  const activeProducts = useMemo(
    () => products.filter((p) => p.active === 1 && (selectedCat === 'tickets' || p.category_id === selectedCat)),
    [products, selectedCat],
  );
  const activeTickets = useMemo(() => ticketTypes.filter((t) => t.active === 1), [ticketTypes]);

  const cartTotal = useMemo(
    () => items.reduce((s, i) => s + i.unit_price * i.quantity, 0) + tickets.reduce((s, t) => s + t.unit_price * t.quantity, 0),
    [items, tickets],
  );

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeEvent) return;
    refreshEventData();
  }, [activeEvent, refreshEventData]);

  useEffect(() => {
    if (boxId) {
      api.get<Sale[]>(`/sales/box/${boxId}/recent`).then(setRecent).catch(() => {});
    }
  }, [boxId, items.length, tickets.length]);

  useEffect(() => {
    if (pendingSale) {
      const timer = setTimeout(() => setPendingSale(null), 1400);
      return () => clearTimeout(timer);
    }
  }, [pendingSale]);

  const playSound = useCallback(() => {
    try {
      saleSound.current = saleSound.current || new AudioContext();
      const ctx = saleSound.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* noop */
    }
  }, []);

  const addItem = (p: CartItem) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product_id === p.product_id);
      if (found) {
        return prev.map((i) => (i.product_id === p.product_id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const changeQty = (productId: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (productId: number) => setItems((prev) => prev.filter((i) => i.product_id !== productId));

  const changeTicketQty = (delta: number) => setTicketQty((q) => Math.max(1, Math.min(200, q + delta)));

  const openTicketModal = (t: TicketType) => {
    setTicketType(t);
    setTicketQty(1);
    setShowTicketModal(true);
  };

  const registerSale = async (method: string) => {
    if (items.length === 0 && tickets.length === 0) {
      push('warn', 'No hay productos en la venta');
      return;
    }
    if (!boxId) {
      push('warn', 'Elegí la caja primero');
      return;
    }
    const payload = {
      event_id: activeEvent!.id,
      box_id: boxId,
      payment_method: method,
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      tickets: tickets.map((t) => ({ ticket_type_id: t.ticket_type_id, quantity: t.quantity })),
    };
    let op: number | null = null;
    let offline = false;
    try {
      const res = await api.post<{ sale: { operation_number: number } }>('/sales', payload);
      op = res.sale.operation_number;
    } catch (e) {
      const err = e as { code?: string; status: number };
      if (err.status === 0 || err.code === 'NETWORK') {
        queueSale(payload);
        setPendingQueue(true);
        offline = true;
      } else {
        push('error', (e as Error).message);
        return;
      }
    }
    playSound();
    setPendingSale({ op, total: cartTotal, method: PAYMENT_LABELS[method] || method, offline });
    setItems([]);
    setTickets([]);
    if (!offline) {
      try {
        api.get<Sale[]>(`/sales/box/${boxId}/recent`).then(setRecent).catch(() => {});
      } catch {
        /* noop */
      }
    }
  };

  const registerTicketSale = async (method: string) => {
    if (!ticketType || !boxId) return;
    const payload = {
      event_id: activeEvent!.id,
      box_id: boxId,
      payment_method: method,
      items: [],
      tickets: [{ ticket_type_id: ticketType.id, quantity: ticketQty }],
    };
    let op: number | null = null;
    let offline = false;
    try {
      const res = await api.post<{ sale: { operation_number: number } }>('/sales', payload);
      op = res.sale.operation_number;
    } catch (e) {
      const err = e as { code?: string; status: number };
      if (err.status === 0 || err.code === 'NETWORK') {
        queueSale(payload);
        setPendingQueue(true);
        offline = true;
      } else {
        push('error', (e as Error).message);
        return;
      }
    }
    setShowTicketModal(false);
    playSound();
    setPendingSale({ op, total: ticketType.price * ticketQty, method: PAYMENT_LABELS[method] || method, offline });
    try {
      api.get<Sale[]>(`/sales/box/${boxId}/recent`).then(setRecent).catch(() => {});
    } catch {
      /* noop */
    }
  };

  const syncNow = async () => {
    const n = await flushQueue();
    setPendingQueue(hasPendingQueue());
    if (n > 0) push('success', `${n} venta(s) pendiente(s) subidas`);
  };

  // ---- selección de evento / caja ----
  const showEventPicker = !activeEvent && events.length > 0;
  const showBoxPicker = activeEvent && !boxId;

  return (
    <div className="pos-screen">
      <div className="pos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div>
            <div className="pos-title">{activeEvent?.name || 'Sin evento'}</div>
            <div className="pos-sub">
              {boxes.find((b) => b.id === boxId)?.name || 'Elegí la caja'} · {user?.name}
            </div>
          </div>
        </div>
        {pendingQueue && (
          <button className="btn btn-sm" style={{ background: 'var(--warn)', color: '#fff' }} onClick={syncNow}>
            ⬆ {hasPendingQueue() ? 'Subir pendientes' : 'Pendientes'}
          </button>
        )}
        <span className="sync-status">
          {pendingQueue ? '📴 Sin conexión' : '🟢 Online'}
        </span>
        <span className="clock">{clock.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
        {user?.role !== 'cajero' && (
          <button className="btn btn-sm btn-ghost" style={{ borderColor: '#334155', color: '#fff' }} onClick={() => navigate('/dashboard')}>
            ⚙ Admin
          </button>
        )}
        <button className="btn btn-sm btn-ghost" style={{ borderColor: '#334155', color: '#fff' }} onClick={() => logout().then(() => navigate('/login'))}>
          ⎋ Salir
        </button>
      </div>

      {pendingQueue && (
        <div className="offline-banner">
          <span>📴 Sin conexión con el servidor. Tus ventas se guardan y suben automáticamente.</span>
          <button className="btn btn-sm" style={{ background: 'var(--warn)', color: '#fff', minHeight: 30 }} onClick={syncNow}>
            Reintentar
          </button>
        </div>
      )}

      <div className="pos-body">
        <div className="pos-products">
          <div className="pos-categories">
            <div className="tab-scroll">
              {activeTickets.length > 0 && (
                <button
                  className={`pos-category-tab ${selectedCat === 'tickets' ? 'active' : ''}`}
                  onClick={() => setSelectedCat('tickets')}
                >
                  🎟️ Entradas
                </button>
              )}
              {activeCategories.map((c) => (
                <button
                  key={c.id}
                  className={`pos-category-tab ${selectedCat === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCat(c.id)}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          {selectedCat === 'tickets' ? (
            <div className="pos-grid">
              {activeTickets.map((t) => (
                <button key={t.id} className="pos-card" onClick={() => openTicketModal(t)}>
                  <div className="pos-card-accent" style={{ background: t.color || '#8b5cf6' }} />
                  <div className="pos-card-icon">{t.icon}</div>
                  <div className="pos-card-name">{t.name}</div>
                  <div className="pos-card-price">{formatMoney(t.price)}</div>
                  {t.last_number != null && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 700 }}>
                      Último: {padNumber(t.last_number, t.digits)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="pos-grid">
              {activeProducts.map((p) => (
                <button key={p.id} className="pos-card" onClick={() => addItem({ product_id: p.id, name: p.name, unit_price: p.price, quantity: 1, icon: p.icon, color: p.color })}>
                  <div className="pos-card-accent" style={{ background: p.color || '#0ea5e9' }} />
                  <div className="pos-card-icon">{p.icon}</div>
                  <div className="pos-card-name">{p.name}</div>
                  <div className="pos-card-price">{formatMoney(p.price)}</div>
                </button>
              ))}
              {activeProducts.length === 0 && (
                <div className="empty" style={{ gridColumn: '1/-1' }}>
                  <div className="empty-icon">🧺</div>
                  <div className="empty-title">Sin productos en esta categoría</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pos-cart">
          <div className="pos-cart-title">
            <span>VENTA ACTUAL</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {items.length + tickets.length} línea(s)
            </span>
          </div>
          <div className="pos-cart-items">
            {items.map((i) => (
              <div className="cart-item" key={`p${i.product_id}`}>
                <div className="ci-icon">{i.icon}</div>
                <div className="ci-info">
                  <div className="ci-name">{i.name}</div>
                  <div className="ci-unit">{formatMoney(i.unit_price)} c/u</div>
                </div>
                <div className="qty-stepper">
                  <button onClick={() => changeQty(i.product_id, -1)}>−</button>
                  <span className="qty-num">{i.quantity}</span>
                  <button onClick={() => changeQty(i.product_id, 1)}>+</button>
                </div>
                <div className="ci-total">{formatMoney(i.unit_price * i.quantity)}</div>
                <button className="icon-btn" style={{ width: 34, height: 34, background: 'var(--danger-soft)', border: 'none', color: 'var(--danger)' }} onClick={() => removeItem(i.product_id)}>
                  🗑
                </button>
              </div>
            ))}
            {tickets.map((t) => (
              <div className="cart-item" key={`t${t.ticket_type_id}`}>
                <div className="ci-icon">{t.icon}</div>
                <div className="ci-info">
                  <div className="ci-name">{t.name}</div>
                  <div className="ci-unit">{formatMoney(t.unit_price)} c/u</div>
                </div>
                <div className="qty-stepper">
                  <button onClick={() => setTickets((prev) => prev.map((x) => (x.ticket_type_id === t.ticket_type_id ? { ...x, quantity: x.quantity - 1 } : x)).filter((x) => x.quantity > 0))}>
                    −
                  </button>
                  <span className="qty-num">{t.quantity}</span>
                  <button onClick={() => setTickets((prev) => prev.map((x) => (x.ticket_type_id === t.ticket_type_id ? { ...x, quantity: x.quantity + 1 } : x)))}>
                    +
                  </button>
                </div>
                <div className="ci-total">{formatMoney(t.unit_price * t.quantity)}</div>
                <button className="icon-btn" style={{ width: 34, height: 34, background: 'var(--danger-soft)', border: 'none', color: 'var(--danger)' }} onClick={() => setTickets((prev) => prev.filter((x) => x.ticket_type_id !== t.ticket_type_id))}>
                  🗑
                </button>
              </div>
            ))}
            {items.length === 0 && tickets.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🛒</div>
                <div className="empty-title">Carrito vacío</div>
                <div style={{ fontSize: 13 }}>Tocá los productos para agregarlos</div>
              </div>
            )}
          </div>

          <div className="pos-cart-total">
            <div className="pos-total-label">Total</div>
            <div className="pos-total-amount">{formatMoney(cartTotal)}</div>
            <div className="pos-payments">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  className="pos-pay-btn"
                  style={{ background: m.color }}
                  disabled={items.length === 0 && tickets.length === 0}
                  onClick={() => registerSale(m.key)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <button
              className="pos-clear-btn"
              onClick={() => {
                setItems([]);
                setTickets([]);
              }}
            >
              🧹 Vaciar carrito
            </button>
          </div>

          {recent.length > 0 && (
            <div className="pos-recent">
              <h4>Últimas ventas de esta caja</h4>
              {recent.map((r) => (
                <div className="recent-row" key={r.id}>
                  <span>
                    #{r.operation_number} · {r.created_at.slice(11, 16)} · {PAYMENT_LABELS[r.payment_method]}
                  </span>
                  <b>{formatMoney(r.total)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmación */}
      {pendingSale && (
        <div className="confirm-overlay">
          <div className="confirm-check">✓</div>
          <div className="confirm-title">{pendingSale.offline ? 'VENTA GUARDADA' : 'VENTA REGISTRADA'}</div>
          <div className="confirm-total">{formatMoney(pendingSale.total)}</div>
          <div className="confirm-method">{pendingSale.method}</div>
          {pendingSale.op != null && <div className="confirm-op">Operación N° {pendingSale.op}</div>}
          {pendingSale.offline && <div className="confirm-op">Se subirá automáticamente al recuperar conexión</div>}
        </div>
      )}

      {/* Modal entradas */}
      {showTicketModal && ticketType && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowTicketModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h2 style={{ fontSize: 18 }}>
                {ticketType.icon} {ticketType.name}
              </h2>
              <button className="icon-btn" onClick={() => setShowTicketModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', color: 'var(--text-soft)', fontWeight: 700 }}>{formatMoney(ticketType.price)} c/u</div>
              <div className="qty-big">
                <button onClick={() => changeTicketQty(-1)}>−</button>
                <span className="qty-big-num">{ticketQty}</span>
                <button onClick={() => changeTicketQty(1)}>+</button>
              </div>
              <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setTicketQty(2)}>2</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTicketQty(3)}>3</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTicketQty(5)}>5</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTicketQty(10)}>10</button>
              </div>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 26, margin: '4px 0 14px' }}>
                {formatMoney(ticketType.price * ticketQty)}
              </div>
              <div className="ticket-pay">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.key} className="pos-pay-btn" style={{ background: m.color }} onClick={() => registerTicketSale(m.key)}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selección de evento */}
      {showEventPicker && (
        <EventPickerModal events={events.filter((e) => e.active === 1)} onSelect={(id) => setActiveEvent(id)} />
      )}

      {/* Selección de caja */}
      {showBoxPicker && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h2 style={{ fontSize: 18 }}>🗄️ Elegí tu caja</h2>
            </div>
            <div className="modal-body">
              {activeBoxes.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🗄️</div>
                  <div className="empty-title">No hay cajas creadas</div>
                  <div style={{ fontSize: 13 }}>El administrador debe crear cajas desde el panel</div>
                </div>
              ) : (
                <div className="ticket-select">
                  {activeBoxes.map((b) => (
                    <button
                      key={b.id}
                      className="ticket-option"
                      onClick={() => {
                        setBoxId(b.id);
                        api.post(`/closes/box/${b.id}/ensure`, { event_id: activeEvent.id }).catch(() => {});
                      }}
                    >
                      <div className="t-icon">🗄️</div>
                      <div className="t-name">{b.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventPickerModal({ events, onSelect }: { events: Event[]; onSelect: (id: number) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h2 style={{ fontSize: 18 }}>🗓️ Elegí el evento</h2>
        </div>
        <div className="modal-body">
          {events.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🗓️</div>
              <div className="empty-title">No hay eventos activos</div>
            </div>
          ) : (
            <div className="ticket-select">
              {events.map((e) => (
                <button key={e.id} className="ticket-option" onClick={() => onSelect(e.id)}>
                  <div className="t-icon">🎪</div>
                  <div className="t-name">{e.name}</div>
                  <div className="t-price">{e.venue || ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}