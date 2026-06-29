import { Router, raw } from 'express';
import crypto from 'crypto';
import { store } from '../services/store';

export const webhooksRouter = Router();

const WEBHOOK_SECRET = process.env.TRONDEALER_WEBHOOK_SECRET || '';

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
    console.log('Webhook recibido:', event);

    if (event.label && (event.status === 'confirmed' || event.status === 'notified')) {
      const order = store.findByReference(event.label);
      if (order && order.paymentStatus === 'awaiting_payment') {
        order.paymentStatus = 'confirmed';
        store.save(order);
        console.log(`Orden ${event.label} confirmada`);
      }
    }

    res.status(200).send('ok');
  },
);
