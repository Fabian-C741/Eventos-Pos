export const PAYMENT_METHODS: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'efectivo', label: 'EFECTIVO', icon: '💵', color: '#16a34a' },
  { key: 'transferencia', label: 'TRANSFERENCIA', icon: '📱', color: '#2563eb' },
  { key: 'tarjeta', label: 'TARJETA', icon: '💳', color: '#7c3aed' },
  { key: 'otro', label: 'OTRO', icon: '📦', color: '#64748b' },
];

export const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export const TICKET_KINDS: { key: string; label: string; icon: string }[] = [
  { key: 'entrada', label: 'Entrada', icon: '🎟️' },
  { key: 'boleta', label: 'Boleta', icon: '🎫' },
  { key: 'rifa', label: 'Rifa', icon: '🎰' },
  { key: 'bono', label: 'Bono', icon: '🎁' },
];

export const CATEGORY_ICONS = [
  '🍰', '🍔', '🍕', '🍟', '🥤', '☕', '💧', '🌭', '🍺', '🍷', '🍗', '🥩',
  '🍟', '🍿', '🍩', '🍪', '🍨', '🥗', '🌮', '🌯', '🍣', '🍜', '🍛', '🍤',
  '🍖', '🥐', '🧀', '🍇', '🍎', '🎟️', '🎫', '🎰', '🎁', '📦', '🧸', '👕',
];

export const PRODUCT_ICONS = [
  '🍰', '🌭', '🍔', '🥤', '💧', '🍟', '🍕', '☕', '🍺', '🍷', '🍗', '🥩',
  '🍿', '🍩', '🍪', '🍨', '🥗', '🌮', '🌯', '🍣', '🍜', '🍛', '🍤', '🍖',
  '🥐', '🧀', '🍎', '🍌', '🍉', '🥕', '🧋', '🍦', '🥞', '🍫', '🍭', '🍮',
  '🎟️', '🎫', '🎰', '🎁', '🧸', '👕', '🛍️', '📿', '🧢', '🕶️', '🔑', '🎈',
];

export const KIND_ICONS: Record<string, string> = {
  entrada: '🎟️',
  boleta: '🎫',
  rifa: '🎰',
  bono: '🎁',
};

export const CATEGORY_COLORS = [
  '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#d946ef',
  '#22c55e', '#eab308', '#3b82f6', '#a855f7',
];

export const APP_NAME = 'Eventos POS';

export const APP_VERSION = '1.0.0';

export const API_BASE = '/api';