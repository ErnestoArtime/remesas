import { Router, raw } from 'express';
import crypto from 'crypto';
import { store } from '../services/store';

export const webhooksRouter = Router();

const WEBHOOK_SECRET = process.env.TRONDEALER_WEBHOOK_SECRET || '';

const STATUS_MAP: Record<string, string> = {
  detected: 'detected',
  confirmed: 'confirmed',
  notified: 'notified',
  swept: 'swept',
};

webhooksRouter.post(
  '/trondealer',
  raw({ type: 'application/json' }),
  (req, res) => {
    if (WEBHOOK_SECRET) {
      const signature = req.headers['x-signature-256'] as string;
      if (!signature) {
        return res.status(401).send('missing signature');
      }

      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(req.body)
        .digest('hex');

      if (
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        return res.status(401).send('invalid signature');
      }
    }

    const event = JSON.parse(req.body.toString());
    const { label, status, txHash, amount, network } = event;

    if (label && status) {
      const orderStatus = STATUS_MAP[status];
      if (orderStatus) {
        const order = store.findByReference(label);
        if (order) {
          order.paymentStatus = orderStatus;

          if (txHash) order.txHash = txHash;
          if (amount) order.paidAmount = amount;
          if (network) order.paidNetwork = network;

          store.save(order);
          console.log(`[webhook] ${label} → ${status}`);
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
