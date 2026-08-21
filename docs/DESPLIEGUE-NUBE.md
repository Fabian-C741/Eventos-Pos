# Despliegue en la nube

Guía operativa del despliegue. El sistema corre como función serverless en Vercel
con base de datos Postgres.

## 1. Arquitectura operativa

- **Desktop (local)**: servidor Node + SQLite. Sin credenciales externas.
- **Nube**: Vercel ejecuta la función serverless sobre Postgres. La UI se sirve
  como SPA estática desde `dist/public`.
- Ambas comparten los mismos servicios, rutas `/api` y lógica de permisos.

## 2. Variables de entorno

| Variable        | Necesaria | Descripción |
|-----------------|-----------|-------------|
| `DATABASE_URL`  | **Sí**    | Connection string de la base de datos (tipo Transaction pooler). |
| `EVENTOS_TZ`    | No        | Zona horaria (default Argentina). |

- `DATABASE_URL` debe ser tipo **Transaction pooler** (puerto `6543`).
- Nunca exponer `DATABASE_URL` ni credenciales al frontend ni en código.

## 3. Despliegue

- `vercel.json` define: build de UI, función serverless, y rewrites SPA.
- Deploy manual: `npx vercel deploy --prod --yes`.
- Alias de producción: `https://eventos-pos.vercel.app`.
- Backups nativos los maneja Supabase; el backup interno del sistema no aplica
  en la nube.

## 4. Checklist de seguridad

- [ ] `DATABASE_URL` solo como variable de entorno (nunca en código ni frontend).
- [ ] `.env*.local` y `.env` en `.gitignore`.
- [ ] `npm test` verde y `npx tsc --noEmit` sin errores antes de cada deploy.
- [ ] Cabeceras de seguridad en respuestas del serverless.
- [ ] Login PIN bloqueado tras 5 intentos fallidos.
