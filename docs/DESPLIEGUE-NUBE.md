# Despliegue en la nube (Vercel + Supabase) — Contrato de seguridad

Este documento fija las reglas de seguridad que se aplicarán cuando levantemos
la versión en la nube. La versión de escritorio ya cumple la parte local; acá se
define cómo se protegen las credenciales y los datos cuando el sistema pasa a la web.

## 1. Claves de Supabase: SOLO en el servidor

- La clave `service_role` de Supabase **NUNCA** debe aparecer en el frontend,
  en archivos de configuración versionados, ni en variables de entorno del
  cliente (código de la app).
- Se guarda únicamente como variable de entorno en Vercel
  (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`), que solo lee el backend serverless.
- La clave `anon` (pública) se usa exclusivamente con **Row Level Security (RLS)**
  activado y políticas restrictivas por usuario.
- Regla práctica: si un secreto puede ser leído por el navegador, no es secreto.

## 2. Acceso a datos desde el frontend

- El navegador **no consulta Supabase directamente** para datos sensibles.
  Toda operación pasa por las funciones serverless (mismas rutas `/api`), que
  validan la sesión y el rol antes de tocar la base de datos.
- La lógica de permisos (superadmin/admin/cajero) se replica en el servidor
  serverless, igual que en la versión local.

## 3. Base de datos

- Migraciones del esquema local (`src/server/db/schema.sql`) aplicadas a
  Postgres de Supabase con un adaptador de migraciones.
- **RLS habilitado** en todas las tablas; políticas que permiten solo lo que
  cada rol necesita.
- Las tablas de sesión expiran y se limpian igual que en local (14 días).

## 4. Red y transporte

- HTTPS obligatorio (Vercel lo provee). HSTS activado.
- Cabeceras de seguridad iguales a la versión local (CSP, X-Frame-Options DENY,
  nosniff, Referrer-Policy).
- Rate limiting en login también en el servidor serverless (mismo límite: 5
  intentos / 10 min), más límite por IP manejado por la plataforma.

## 5. Verificación antes de subir

- Correr el checklist:
  - [ ] Sin `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_URL` en código frontend.
  - [ ] `.env*.local` y `.env` en `.gitignore`.
  - [ ] RLS activo con políticas revisadas.
  - [ ] `npm test` verde (22 tests).
  - [ ] Login con PIN bloqueado tras 5 intentos (verificado en la nube).
  - [ ] Cabecera CSP presente en respuestas del serverless.

## 6. Puntos de contacto con la app local

- Las claves de Supabase se inyectan por variables de entorno al servidor
  serverless; la versión local sigue usando SQLite sin credenciales en código.
- El backup local (escritorio) y los datos de la nube conviven: en el evento se
  usa local con cola offline; al volver a tener internet se sincroniza.