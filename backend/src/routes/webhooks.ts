import crypto from 'crypto';
import { Router, raw } from 'express';
import { normalizeTronDealerEvent } from '../providers/trondealer/trondealer.normalizer';
import { applyTronDealerEvent } from '../providers/trondealer/trondealer.webhook';
import { toPaymentEvent } from '../providers/trondealer/trondealer.types';
import { store } from '../services/store';

export const webhooksRouter = Router();

const WEBHOOK_SECRET = process.env.TRONDEALER_WEBHOOK_SECRET;

export function validTronDealerSignature(
  body: Buffer,
  signature: string,
  secret = WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

webhooksRouter.post(
  '/trondealer',
  raw({ type: 'application/json', limit: '256kb' }),
  (req, res) => {
    if (!WEBHOOK_SECRET) {
      console.error('[webhook] TRONDEALER_WEBHOOK_SECRET no está configurado');
      return res.status(500).send('server misconfiguration');
    }

    const signature = typeof req.headers['x-signature-256'] === 'string'
      ? req.headers['x-signature-256']
      : '';
    if (!signature) return res.status(401).send('missing signature');
    if (!Buffer.isBuffer(req.body)) return res.status(415).send('application/json required');
    if (!validTronDealerSignature(req.body, signature)) {
      return res.status(401).send('invalid signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).send('invalid json');
    }

    let normalized;
    try {
      normalized = normalizeTronDealerEvent(payload);
    } catch {
      return res.status(400).send('invalid payload');
    }

    if (store.hasWebhookEvent(normalized.deduplicationKey)) {
      return res.status(200).send('duplicate ignored');
    }

    const receivedAt = new Date().toISOString();
    const paymentEvent = toPaymentEvent(normalized, receivedAt);
    const order = normalized.label
      ? store.findByReference(normalized.label)
      : undefined;

    let outcome: 'applied' | 'unknown' | 'order_not_found' = 'order_not_found';
    if (order) {
      const alreadyOnOrder = order.paymentEvents?.some(
        (event) => event.deduplicationKey === normalized.deduplicationKey,
      );
      if (!alreadyOnOrder) {
        applyTronDealerEvent(order, normalized, receivedAt);
        order.paymentEvents = [...(order.paymentEvents || []), paymentEvent];
        store.save(order);

        const intent = order.paymentIntentId
          ? store.findPaymentIntentById(order.paymentIntentId)
          : store.findPaymentIntentByOrderReference(order.reference);
        if (intent) {
          intent.amountReceivedUsd = order.paidAmount ?? intent.amountReceivedUsd;
          intent.amountReceivedNative = order.paidAmountNative;
          intent.priceUsd = order.paidPriceUsd;
          intent.confirmations = order.confirmations ?? intent.confirmations;
          intent.minConfirmations = order.minConfirmations ?? intent.minConfirmations;
          const statusMap = {
            detected: 'detected',
            confirming: 'confirming',
            confirmed: 'confirmed',
            notified: 'confirmed',
            swept: 'swept',
            underpaid: 'underpaid',
            payment_review: 'review',
          } as const;
          const mappedStatus = statusMap[order.paymentStatus as keyof typeof statusMap];
          if (mappedStatus) {
            intent.status = (
              mappedStatus === 'confirmed'
              && (order.paymentExcessUsd ?? 0) > 0
            ) ? 'overpaid' : mappedStatus;
          }
          intent.updatedAt = receivedAt;
          store.savePaymentIntent(intent);
        }
      }
      outcome = normalized.eventType === 'unknown' ? 'unknown' : 'applied';
    }

    store.saveWebhookEvent({
      deduplicationKey: normalized.deduplicationKey,
      label: normalized.label,
      event: paymentEvent,
      outcome,
    });

    if (!order) {
      console.warn(`[webhook] Orden no encontrada para evento ${normalized.deduplicationKey}`);
    } else if (normalized.eventType === 'unknown') {
      console.warn(`[webhook] Evento desconocido para ${normalized.label}`);
    }

    return res.status(200).send('ok');
  },
);
