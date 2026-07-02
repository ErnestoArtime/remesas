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
```

Genera cada secreto local con `openssl rand -hex 32`. No reutilices el secreto del webhook como clave administrativa.

## Flujo de pago

1. El cliente registra la orden en `POST /api/orders`.
2. El backend asigna una wallet mediante TronDealer.
3. El cliente paga el total exacto en USDT mediante BSC/BEP-20. No debe usar TRC-20.
4. TronDealer notifica los estados `detected`, `confirmed`, `notified` y `swept`.
5. La entrega sólo puede asignarse después de `confirmed`, nunca en `detected`.

El webhook compara el importe confirmado con `totalToPay`. Los pagos insuficientes quedan en `underpaid` y los eventos sin importe verificable en `payment_review`; ninguno puede asignarse para entrega.

Webhook público:

```text
https://cashflowqba.eav-labs.com/api/webhooks/trondealer
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
- `POST /api/admin/agents`
- `PATCH /api/admin/orders/:reference/payment-status`
- `PATCH /api/admin/orders/:reference/assign`
- `PATCH /api/admin/orders/:reference/delivery-status`

## Compilación

```bash
npm run build
cd backend && npm run build
```
