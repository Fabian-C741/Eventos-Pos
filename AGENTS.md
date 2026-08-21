# Eventos POS — Reglas del proyecto

## Qué es el sistema

Sistema SaaS de gestión de eventos, ventas y recaudación. Los usuarios acceden desde el navegador (desktop o celular). El sistema maneja:

- **Eventos**: fiestas, festivales, etc. Cada admin gestiona sus eventos.
- **Productos**: vendidos por categorías (Comidas, Bebidas, etc.) con precio, ícono y color.
- **Entradas**: boletería numerada (general, rifa, bono) con secuencia automática.
- **Cajas (Boxes)**: cada caja define qué vende (entradas y/o categorías de productos). El cajero asignado a una caja trabaja solo en ella.
- **Ventas**: registro de cada venta con método de pago (Efectivo, Transferencia, Tarjeta), operación N°, y detalle de ítems/entradas.
- **Arqueo (Closes)**: apertura y cierre de caja con declarado vs esperado.
- **Reportes**: dashboard, estadísticas, reportes por vendedor y por caja.
- **Offline**: el POS funciona sin conexión; las ventas se guardan localmente y se sincronizan al reconectar.

## Roles y jerarquía

```
superadmin
  └── admin (gestiona sus eventos y cajeros)
        └── cajero (trabaja en su caja asignada)
```

- **superadmin**: ve todo. Crea admins y asigna eventos.
- **admin**: ve solo sus eventos y sus cajeros.
- **cajero**: ve solo su caja y lo que esa caja vende (definido en la configuración de la caja).

## Modelo de aislamiento (SaaS)

Cada entidad tiene un `owner_id`:
- `events.owner_id`: quién es dueño del evento.
- `users.owner_id`: el admin al que pertenece el cajero.

El superadmin ve todo (`scope: 'all'`). El admin ve lo suyo. El cajero ve lo de su admin.

**IMPORTANTE**: eventos existentes sin `owner_id` solo los ve el superadmin. Si un admin no ve sus eventos, verificar que `owner_id` esté asignado.

## Reglas de desarrollo CRÍTICAS

### Al modificar código del servidor (`src/server/**`)

1. Ejecutar `npm run build:serverless` para regenerar el bundle.
2. Commitear el archivo `serverless/index.cjs` junto con los cambios.
3. El bundle generado es lo que Vercel ejecuta en producción.

### Comandos

- **Tests**: `npm test` (NO vitest). Usa `tsx --test tests/*.test.ts`.
- **TypeScript check**: `npx tsc --noEmit`.
- **Build serverless**: `npm run build:serverless`.
- **Build UI**: `vite build` (automático en deploy de Vercel).

### Flujo de deploy

1. Hacer cambios en `dev`.
2. Correr `npm test` y `npx tsc --noEmit`.
3. Si se tocó `src/server/**`, regenerar bundle: `npm run build:serverless`.
4. Commitear (incluyendo `serverless/index.cjs` si se regeneró).
5. Push a `dev`, merge a `master`, push `master`.
6. Deploy: `npx vercel deploy --prod --yes`.
7. Alias de producción: `https://eventos-pos.vercel.app`.

### Horario y zona horaria

- El sistema usa la zona horaria configurada (`EVENTOS_TZ`, default Argentina).
- Los logs y ventas se registran en hora local.
- No hardcodear zona horaria; usar la configurada.

## Convenciones de la UI

- **Desktop**: layout con sidebar + contenido.
- **Móvil** (≤980px): sidebar se convierte en menú hamburguesa, carrito se compacta.
- El carrito en móvil muestra solo total + botones de pago; la lista de ítems se expande con "▾ Ver".
- Las ventas usan `100svh` / `100dvh` para ajustar al viewport real del celular.
- Los modales usan z-index alto (1000+); la barra de pago del POS usa z-index medio.
- Colores y estilos siguen la paleta CSS definida en `src/ui/styles/global.css` y `pos.css`.

## Datos de prueba y testing

- Los tests usan SQLite en memoria (temp directorio).
- El test "eliminar evento" borra el evento principal del setup; tests posteriores deben crear su propio evento si lo necesitan.
- Los tests cubren: CRUD de entidades, permisos por rol, ventas, cierres, backup/restore, auditoría, SaaS scoping, offline queue.

## Lo que NO se debe cambiar sin verificar

- **`PAYMENT_METHODS`**: incluye 4 métodos. El POS filtra "otro" siempre y "tarjeta" si no está habilitado. No eliminar "otro" del array (datos históricos).
- **`pos_categories` / `pos_tickets` en users**: campos legacy. Se mantienen para cajeros sin caja asignada (fallback). No borrar.
- **`pos_box_id` en users**: la caja define el puesto del cajero. Es el mecanismo principal de asignación.
- **`pos_categories` / `pos_tickets` en boxes**: definen qué vende cada caja. Son el mecanismo principal de configuración del puesto.
- **Login PIN**: los cajeros usan PIN de 4 dígitos (no contraseña). Bloqueo tras 5 intentos fallidos (10 min).
- **Bundle `serverless/index.cjs`**: si no se regenera después de cambiar el servidor, el deploy usa código viejo. Siempre commitear el bundle después de tocar `src/server/**`.
