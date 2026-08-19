export type Role = 'superadmin' | 'admin' | 'cajero';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
export type SaleStatus = 'activa' | 'anulada';
export type CloseStatus = 'abierto' | 'cerrado';
export type TicketKind = 'entrada' | 'boleta' | 'rifa' | 'bono';

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: number;
  created_at: string;
  last_login_at: string | null;
  pos_categories?: string | null;
  pos_tickets?: number | null;
  owner_id?: number | null;
}

export interface Event {
  id: number;
  name: string;
  description: string;
  venue: string;
  start_date: string;
  end_date: string;
  active: number;
  owner_id?: number | null;
  created_at: string;
}

export interface Box {
  id: number;
  event_id: number;
  name: string;
  active: number;
}

export interface Category {
  id: number;
  event_id: number;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  active: number;
}

export interface Product {
  id: number;
  event_id: number;
  category_id: number | null;
  name: string;
  price: number;
  icon: string;
  color: string;
  sort_order: number;
  active: number;
}

export interface TicketType {
  id: number;
  event_id: number;
  name: string;
  price: number;
  kind: TicketKind;
  start_number: number | null;
  last_number: number | null;
  digits: number;
  icon: string;
  color: string;
  active: number;
  sort_order: number;
}

export interface CartItem {
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  icon: string;
  color: string;
}

export interface CartTicket {
  ticket_type_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  icon: string;
  color: string;
}

export interface SaleItem {
  id: number;
  product_id: number | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  icon?: string;
  color?: string;
}

export interface SaleTicket {
  id: number;
  ticket_type_id: number | null;
  ticket_type_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  icon?: string;
  color?: string;
}

export interface Sale {
  id: number;
  event_id: number;
  event_name?: string;
  box_id: number | null;
  box_name?: string;
  user_id: number | null;
  user_name?: string;
  operation_number: number;
  total: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  created_at: string;
}

export interface SaleDetail extends Sale {
  items: SaleItem[];
  tickets: SaleTicket[];
  voided?: { reason: string; user_name?: string; created_at: string } | null;
}

export interface Ticket {
  id: number;
  sale_id: number;
  ticket_type_id: number;
  ticket_type_name?: string;
  number: number;
  created_at: string;
}

export interface Close {
  id: number;
  event_id: number;
  box_id: number;
  box_name?: string;
  user_id: number | null;
  user_name?: string;
  opened_at: string;
  closed_at: string | null;
  expected_total: number;
  declared_total: number | null;
  difference: number | null;
  status: CloseStatus;
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error' | 'fatal';
  module: string;
  message: string;
  details: string;
  user_id: number | null;
  device: string;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number;
  details: string;
  created_at: string;
}

export interface BackupInfo {
  name: string;
  size: number;
  created_at: string;
}

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  pos_categories?: string | null;
  pos_tickets?: number | null;
  owner_id?: number | null;
}

export interface AppSettings {
  app_name: string;
  sound_enabled: string;
  auto_backup: string;
  device_name: string;
  currency_symbol: string;
  receipt_footer: string;
  login_logo: string;
}

export interface DashboardData {
  total_recaudado: number;
  total_efectivo: number;
  total_transferencia: number;
  total_tarjeta: number;
  total_otro: number;
  total_ventas: number;
  total_entradas: number;
  total_boletas: number;
  total_productos: number;
  ventas_anuladas: number;
  monto_anulado: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface SeriesMultiPoint {
  label: string;
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  otro: number;
}

export interface StatsData {
  por_hora: SeriesMultiPoint[];
  por_dia: SeriesMultiPoint[];
  top_productos: SeriesPoint[];
  por_categoria: SeriesPoint[];
  por_cajero: SeriesPoint[];
  por_caja: SeriesPoint[];
  por_pago: SeriesPoint[];
  por_tipo_ticket: SeriesPoint[];
}

export interface CloseSummary {
  sales_count: number;
  by_payment: Record<PaymentMethod, number>;
  total: number;
  closed_at?: string;
}