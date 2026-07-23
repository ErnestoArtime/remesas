import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  NotificationEvent,
  Order,
  PaymentIntent,
  ProviderWebhookEvent,
} from '../src/models/order';
import { buildReconciliationSnapshot } from '../src/services/reconciliation';

test('reconciliación detecta diferencias, webhooks huérfanos y notificaciones fallidas', () => {
  const order = {
    reference: 'RC-2026-RECON',
    paymentStatus: 'underpaid',
    quote: { totalToPay: 100 },
  } as Order;
  const intent = {
    orderReference: order.reference,
    amountDueUsd: 100,
    amountReceivedUsd: 90,
  } as PaymentIntent;
  const webhook = {
    label: 'RC-2026-MISSING',
    outcome: 'order_not_found',
    event: { eventType: 'transaction.incoming' },
  } as ProviderWebhookEvent;
  const notification = {
    orderReference: order.reference,
    status: 'failed',
    attempts: 3,
    template: 'delivery_assigned_sender',
  } as NotificationEvent;

  const snapshot = buildReconciliationSnapshot([order], [intent], [webhook], [notification]);
  const types = snapshot.alerts.map((alert) => alert.type);
  assert.ok(types.includes('underpaid'));
  assert.ok(types.includes('amount_difference'));
  assert.ok(types.includes('deposit_without_order'));
  assert.ok(types.includes('notification_failed'));
});
