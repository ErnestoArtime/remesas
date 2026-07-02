import crypto from 'crypto';
import { Router } from 'express';
import { Order } from '../models/order';
import { store } from '../services/store';
import { tronService } from '../services/trondealer';
import { calculateQuote } from '../services/quote';

export const ordersRouter = Router();

function generateReference(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `RC-${year}-${suffix}`;
}

ordersRouter.post('/orders', async (req, res) => {
  try {
    const {
      paymentMethod,
      deliverySpeed,
      amountDelivered,
      senderName,
      senderPhone,
      beneficiaryName,
      beneficiaryPhone,
      municipality,
      address,
      notes,
    } = req.body;

    if (!senderName || !beneficiaryName || !municipality) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const reference = generateReference();
    const paymentStatus = paymentMethod === 'euro' ? 'contact_whatsapp' : 'pending_wallet';

    const quote = calculateQuote({ amountDelivered: Number(amountDelivered) || 0, deliverySpeed });

    const order: Order = {
      reference,
      paymentMethod,
      paymentStatus,
      deliverySpeed,
      quote,
      senderName,
      senderPhone,
      beneficiaryName,
      beneficiaryPhone,
      municipality,
      address,
      notes: notes || '',
      deliveryStatus: 'unassigned',
      createdAt: new Date().toISOString(),
    };

    if (paymentMethod === 'usdt' && tronService.checkConfig()) {
      try {
        const wallet = await tronService.assignWallet(reference);
        order.tronWalletAddress = wallet;
        order.paymentStatus = 'awaiting_payment';
      } catch (err) {
        console.error('Error asignando wallet TronDealer:', err);
      }
    }

    store.save(order);
    res.status(201).json(order);
  } catch (err) {
    console.error('Error creando orden:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

ordersRouter.get('/orders/:reference', (req, res) => {
  const order = store.findByReference(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(order);
});

ordersRouter.get('/orders', (_req, res) => {
  res.json(store.findAll());
});
