-- Diagnóstico Eventos POS — correr en Supabase → SQL Editor → Run
-- Muestra: versión, tablas existentes y conteo de registros.

SELECT version();

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT 'users' AS entidad, COUNT(*) AS cantidad FROM users
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'boxes', COUNT(*) FROM boxes
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'ticket_types', COUNT(*) FROM ticket_types
UNION ALL SELECT 'sales', COUNT(*) FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'sale_tickets', COUNT(*) FROM sale_tickets
UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'closes', COUNT(*) FROM closes
UNION ALL SELECT 'voids', COUNT(*) FROM voids
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL SELECT 'app_logs', COUNT(*) FROM app_logs
UNION ALL SELECT 'settings', COUNT(*) FROM settings
UNION ALL SELECT 'seq', COUNT(*) FROM seq
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions;