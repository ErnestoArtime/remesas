# Remesa Clara

MVP web para cotizar y registrar remesas pagadas con USDT y entregadas en USD efectivo.

## Desarrollo

```bash
npm install
npm start
```

La aplicación queda disponible en `http://127.0.0.1:4200`.

## Estado actual

- Cotización reactiva por monto, zona y velocidad.
- Tarifas por tramo y entrega transparentes.
- Captura validada de remitente y beneficiario.
- Confirmación local del pedido.
- Diseño responsive validado en escritorio y móvil.

## Integración pendiente

Angular nunca debe recibir `TRONDEALER_API_KEY` ni `TRONDEALER_WEBHOOK_SECRET`.
El backend deberá exponer estos endpoints propios:

- `POST /api/remittances`: guarda el pedido y asigna una wallet con TronDealer.
- `GET /api/remittances/:reference`: devuelve estado, monto y dirección de pago.
- `POST /api/webhooks/trondealer`: valida `X-Signature-256`, deduplica eventos y actualiza el pago.

La entrega en efectivo sólo puede liberarse cuando el pago esté confirmado, nunca cuando esté solamente detectado.

## Compilación

```bash
npm run build
```
