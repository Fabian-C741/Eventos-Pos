import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../api/client';
import type { Event, Category, Product, TicketType, Box } from '../../shared/types';

interface DataState {
  events: Event[];
  categories: Category[];
  products: Product[];
  ticketTypes: TicketType[];
  boxes: Box[];
  activeEvent: Event | null;
  setActiveEvent: (id: number | null) => void;
  refreshEvents: () => Promise<void>;
  refreshEventData: () => Promise<void>;
  loading: boolean;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEventState] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshEvents = useCallback(async () => {
    try {
      const evs = await api.get<Event[]>('/events');
      setEvents(evs);
      const stored = Number(localStorage.getItem('epos_active_event'));
      const active = evs.find((e) => e.id === stored && e.active === 1) || evs.find((e) => e.active === 1) || null;
      setActiveEventState(active);
      if (active) localStorage.setItem('epos_active_event', String(active.id));
    } catch {
      /* noop */
    }
  }, []);

  const refreshEventData = useCallback(async () => {
    if (!activeEvent) {
      setCategories([]);
      setProducts([]);
      setTicketTypes([]);
      setBoxes([]);
      return;
    }
    try {
      const [cats, prods, tickets, bxs] = await Promise.all([
        api.get<Category[]>(`/events/${activeEvent.id}/categories`),
        api.get<Product[]>(`/events/${activeEvent.id}/products`),
        api.get<TicketType[]>(`/events/${activeEvent.id}/tickets`),
        api.get<Box[]>(`/events/${activeEvent.id}/boxes`),
      ]);
      setCategories(cats);
      setProducts(prods);
      setTicketTypes(tickets);
      setBoxes(bxs);
    } catch {
      /* noop */
    }
  }, [activeEvent]);

  useEffect(() => {
    refreshEvents().finally(() => setLoading(false));
  }, [refreshEvents]);

  useEffect(() => {
    refreshEventData();
  }, [refreshEventData]);

  useEffect(() => {
    const t = setInterval(() => {
      refreshEventData();
    }, 15000);
    return () => clearInterval(t);
  }, [refreshEventData]);

  const setActiveEvent = useCallback((id: number | null) => {
    if (id === null) {
      localStorage.removeItem('epos_active_event');
      setActiveEventState(null);
      return;
    }
    localStorage.setItem('epos_active_event', String(id));
    setEvents((prev) => {
      const ev = prev.find((e) => e.id === id);
      setActiveEventState(ev ?? null);
      return prev;
    });
  }, []);

  return (
    <DataContext.Provider
      value={{
        events,
        categories,
        products,
        ticketTypes,
        boxes,
        activeEvent,
        setActiveEvent,
        refreshEvents,
        refreshEventData,
        loading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData fuera de DataProvider');
  return ctx;
}