import { Router, raw } from 'express';
import crypto from 'crypto';
import { store } from '../services/store';

export const webhooksRouter = Router();

const WEBHOOK_SECRET = process.env.TRONDEALER_WEBHOOK_SECRET;

import type { PaymentEvent, PaymentStatus } from '../models/order';

const STATUS_MAP: Record<string, PaymentStatus> = {
  detected: 'detected',
  confirmed: 'confirmed',
  notified: 'notified',
  swept: 'swept',
};

webhooksRouter.post(
  '/trondealer',
  raw({ type: 'application/json' }),
  (req, res) => {
    if (!WEBHOOK_SECRET) {
      console.error('[webhook] TRONDEALER_WEBHOOK_SECRET no está configurado');
      return res.status(500).send('server misconfiguration');
    }

    const signature = req.headers['x-signature-256'] as string;
    if (!signature) {
      return res.status(401).send('missing signature');
    }

    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return res.status(401).send('invalid signature');
    }

    const event = JSON.parse(req.body.toString());
    const { label, status } = event;
    const txHash = event.txHash || event.tx_hash || '';
    const logIndex = event.logIndex || event.log_index || '';
    const amount = event.amount;
    const network = event.network;

    if (label && status) {
      const orderStatus = STATUS_MAP[status];
      if (orderStatus) {
        const order = store.findByReference(label);
        if (order) {
          if (txHash) order.txHash = txHash;
          const eventAmount = Number(amount);
          if (amount !== undefined && Number.isFinite(eventAmount)) order.paidAmount = eventAmount;
          if (network) order.paidNetwork = network;

          if (orderStatus === 'detected') {
            order.paymentStatus = 'detected';
          } else {
            const paidAmount = Number(order.paidAmount);
            if (!Number.isFinite(paidAmount)) {
              order.paymentStatus = 'payment_review';
            } else if (paidAmount + 0.000001 < order.quote.totalToPay) {
              order.paymentStatus = 'underpaid';
            } else {
              order.paymentStatus = orderStatus;
            }
          }

          const paymentEvent: PaymentEvent = {
            txHash,
            logIndex,
            status,
            amount: amount !== undefined ? String(amount) : '',
            network: network || '',
            rawBody: req.body.toString(),
            signature,
            receivedAt: new Date().toISOString(),
          };
          order.paymentEvents = [...(order.paymentEvents || []), paymentEvent];

          store.save(order);
          console.log(`[webhook] ${label} → ${status} (tx: ${txHash})`);
        } else {
          console.warn(`[webhook] Orden no encontrada: ${label}`);
        }
      } else {
        console.log(`[webhook] Estado desconocido para ${label}: ${status}`);
      }
    }

    res.status(200).send('ok');
  },
);
