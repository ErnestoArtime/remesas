# CashFlowQba

Aplicación Angular y API Node.js para registrar envíos pagados con USDT o coordinados en EUR, con entrega de efectivo en La Habana.

## Desarrollo

```bash
npm install
cd backend && npm ci && cd ..
npm start
```

El frontend local queda disponible en `http://127.0.0.1:4200`.

## Configuración del servidor

Crea `.env` en la raíz del proyecto:

```env
TRONDEALER_API_KEY=td_clave_generada_por_trondealer
TRONDEALER_WEBHOOK_SECRET=secreto_hexadecimal_de_64_caracteres
ADMIN_API_KEY=otra_clave_aleatoria_de_64_caracteres
CORS_ORIGIN=https://remesa.eav-labs.com
PAYMENT_TOLERANCE_USD=0.05
```

Genera cada secreto local con `openssl rand -hex 32`. No reutilices el secreto del webhook como clave administrativa.

## Flujo de pago

1. El cliente registra la orden en `POST /api/orders`.
2. El backend asigna una wallet mediante TronDealer.
3. El cliente paga el activo y la red habilitados en la cotización.
4. TronDealer notifica `incoming`, `confirmation_update`, `confirmed` y `swept`.
5. `confirmation_update` solo alimenta el progreso visual.
6. La entrega sólo puede asignarse después de `confirmed`, nunca en `detected` o `confirming`.

El webhook compara el importe confirmado con `totalToPay`. Los pagos insuficientes quedan en `underpaid` y los eventos sin importe verificable en `payment_review`; ninguno puede asignarse para entrega.

Webhook público:

```text
https://remesa.eav-labs.com/api/webhooks/trondealer
```

## Operaciones

El panel se encuentra en `/admin`. La clave se introduce al iniciar la sesión y se conserva únicamente en `sessionStorage`.

Funciones disponibles:

- Listar y filtrar pedidos.
- Registrar agentes de entrega.
- Confirmar manualmente los pagos EUR coordinados por WhatsApp.
- Asignar pedidos con pago confirmado.
- Marcar entregas como asignadas, en camino, entregadas, con incidencia o canceladas.

## API administrativa

Todas las llamadas requieren `Authorization: Bearer <ADMIN_API_KEY>`.

- `GET /api/admin/orders`
- `GET /api/admin/agents`
- `GET /api/admin/payment-options`
- `PATCH /api/admin/payment-options/:id`
- `GET /api/admin/delivery-methods`
- `PATCH /api/admin/delivery-methods/:id`
- `GET /api/admin/notifications`
- `GET /api/admin/audit-logs`
- `GET /api/admin/reconciliation`
- `POST /api/admin/agents`
- `PATCH /api/admin/orders/:reference/payment-status`
- `PATCH /api/admin/orders/:reference/assign`
- `PATCH /api/admin/orders/:reference/delivery-status`

## Compilación

```bash
npm run build
cd backend && npm run build
```

## Despliegue Docker en el VPS

La aplicación conserva los datos locales en `backend/data`, expone el frontend
solo en `127.0.0.1:3000` y conecta ambos servicios a la red externa `proxy`.

```bash
docker network inspect proxy >/dev/null
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Después del despliegue se debe validar:

- `https://remesa.eav-labs.com/`
- `https://remesa.eav-labs.com/api/health`
- creación de cotización;
- acceso al panel administrativo;
- recepción firmada del webhook TronDealer.
