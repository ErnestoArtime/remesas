import type {
  NotificationEvent,
  Order,
  PaymentIntent,
  ProviderWebhookEvent,
} from '../models/order';

export interface ReconciliationAlert {
  type:
    | 'wallet_without_deposit'
    | 'deposit_without_order'
    | 'underpaid'
    | 'confirmed_without_sweep'
    | 'unknown_webhook'
    | 'amount_difference'
    | 'notification_failed';
  severity: 'info' | 'warning' | 'critical';
  reference?: string;
  message: string;
}

export function buildReconciliationSnapshot(
  orders: Order[],
  intents: PaymentIntent[],
  webhookEvents: ProviderWebhookEvent[],
  notifications: NotificationEvent[],
): { generatedAt: string; alerts: ReconciliationAlert[] } {
  const alerts: ReconciliationAlert[] = [];
  const orderReferences = new Set(orders.map((order) => order.reference));

  for (const order of orders) {
    const intent = intents.find((item) => item.orderReference === order.reference);
    if (order.tronWalletAddress && ['pending_wallet', 'awaiting_payment'].includes(order.paymentStatus)) {
      alerts.push({
        type: 'wallet_without_deposit',
        severity: 'info',
        reference: order.reference,
        message: 'Wallet asignada sin depósito detectado.',
      });
    }
    if (order.paymentStatus === 'underpaid') {
      alerts.push({
        type: 'underpaid',
        severity: 'critical',
        reference: order.reference,
        message: 'Pago insuficiente; la entrega permanece bloqueada.',
      });
    }
    if (order.paymentStatus === 'confirmed' && !order.paymentSweptAt) {
      alerts.push({
        type: 'confirmed_without_sweep',
        severity: 'warning',
        reference: order.reference,
        message: 'Pago confirmado todavía sin evento de barrido.',
      });
    }
    if (
      intent
      && Math.abs(intent.amountReceivedUsd - intent.amountDueUsd) > 0.05
      && intent.amountReceivedUsd > 0
    ) {
      alerts.push({
        type: 'amount_difference',
        severity: intent.amountReceivedUsd < intent.amountDueUsd ? 'critical' : 'warning',
        reference: order.reference,
        message: `Diferencia de pago: recibido ${intent.amountReceivedUsd} USD, esperado ${intent.amountDueUsd} USD.`,
      });
    }
  }

  for (const event of webhookEvents) {
    if (event.outcome === 'order_not_found' || (event.label && !orderReferences.has(event.label))) {
      alerts.push({
        type: 'deposit_without_order',
        severity: 'critical',
        reference: event.label || undefined,
        message: 'Evento de depósito sin orden asociada.',
      });
    } else if (event.outcome === 'unknown') {
      alerts.push({
        type: 'unknown_webhook',
        severity: 'warning',
        reference: event.label || undefined,
        message: `Webhook desconocido: ${event.event.eventType}.`,
      });
    }
  }

  for (const notification of notifications.filter((item) => item.status === 'failed')) {
    alerts.push({
      type: 'notification_failed',
      severity: 'warning',
      reference: notification.orderReference,
      message: `Notificación ${notification.template} fallida tras ${notification.attempts} intento(s).`,
    });
  }

  return { generatedAt: new Date().toISOString(), alerts };
}
