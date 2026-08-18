# Despliegue en la nube (Vercel + Supabase)

Guía operativa de la versión en la nube. El backend corre como función serverless
(`api/index.ts`), usa **Postgres de Supabase** como base y la UI se sirve desde
`dist/public`.

## 1. Arquitectura

- **Desktop (local)**: servidor Node propio (`src/server/index.ts`) + SQLite
  (`src/server/db/sqlite.ts`). Sin credenciales.
- **Nube**: Vercel ejecuta `api/index.ts` (bootstrap async de `src/server/app.ts`)
  sobre Postgres (`src/server/db/pg.ts`). La fachada `src/server/db/db.ts`
  elige backend según `process.env.DATABASE_URL`.
- Ambas comparten los mismos servicios, rutas `/api` y lógica de permisos.

## 2. Variables de entorno (Vercel)

| Variable        | Necesaria | Descripción |
|-----------------|-----------|-------------|
| `DATABASE_URL`  | **Sí**    | Connection string **"Transaction pooler"** de Supabase. |
| `EVENTOS_TZ`    | No        | Zona horaria (default `America/Argentina/Buenos_Aires`). |

- `DATABASE_URL` debe ser la de **Transaction pooler** (puerto `6543`), NO la de
  session mode ni la URL con la key `service_role`.
- Se construye en Supabase → Settings → Database → *Connection string →
  Transaction pooler*: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
- La **contraseña es la de la base de datos** (la que se crea al inicializar el
  proyecto), no la clave de servicio.

## 3. Esquema y credenciales

- `cloud/schema.sql` es el esquema Postgres (equivalente a `src/server/db/schema.sql`).
  Ya se ejecutó en Supabase (SQL Editor). Sirve de referencia y para recrear un proyecto.
- El driver `postgres` se conecta con el rol `postgres` (propietario): **no hace falta RLS**
  ni `service_role`. Nunca exponer `DATABASE_URL` ni credenciales al frontend.
- `pg.ts` registra `types` para `bigint`/`numeric` (los devuelve como `number`) y
  fija `connection.timezone` a `EVENTOS_TZ`.

## 4. Despliegue

- `vercel.json`: build `npm run build:ui`, output `dist/public`, función `api/index.ts`
  con runtime `nodejs22.x`, rewrites `/api/*` → función y resto → `index.html` (SPA).
- Push a `master` → Vercel redeploya. Probar:
  - `/api/auth/status` → `{"setup": true}` (primer alta).
  - Alta de admin, login, venta, cierre de caja, reportes.
- Backups nativos y descarga de la base están deshabilitados en la nube
  (Supabase maneja backups); `settings.auto_backup` no aplica.

## 5. Checklist de seguridad

- [ ] `DATABASE_URL` solo como variable de entorno (nunca en código ni frontend).
- [ ] `.env*.local` y `.env` en `.gitignore`.
- [ ] `npm test` verde (31 tests) y `npx tsc --noEmit` sin errores.
- [ ] Cabeceras CSP/security presentes en respuestas del serverless.
- [ ] Login con PIN bloqueado tras 5 intentos (verificado en la nube).
- [ ] No hay `service_role` usada por el driver (se usa el rol de la DB).