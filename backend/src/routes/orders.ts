import { Router } from 'express';
import { Order } from '../models/order';
import { store } from '../services/store';
import { tronService } from '../services/trondealer';

export const ordersRouter = Router();

function generateReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `RC-${year}-${suffix}`;
}

ordersRouter.post('/orders', async (req, res) => {
  try {
    const {
      paymentMethod,
      deliverySpeed,
      amountDelivered,
      totalToPay,
      serviceFee,
      deliveryFee,
      feePercentage,
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

    const estimatedDelivery = deliverySpeed === 'priority' ? 'Hasta 6 horas' : 'En 24 horas';

    const order: Order = {
      reference,
      paymentMethod,
      paymentStatus,
      deliverySpeed,
      quote: {
        amountDelivered,
        totalToPay,
        serviceFee,
        deliveryFee,
        feePercentage,
        estimatedDelivery,
      },
      senderName,
      senderPhone,
      beneficiaryName,
      beneficiaryPhone,
      municipality,
      address,
      notes: notes || '',
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
