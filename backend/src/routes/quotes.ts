import crypto from 'crypto';
import { Router } from 'express';
import type { DeliverySpeed, Quote } from '../models/order';
import { calculateQuote, getFeeSchedule } from '../services/quote';
import { store } from '../services/store';
import { quoteRequestSchema } from '../validation/schemas';

export const quotesRouter = Router();

const QUOTE_TTL_MS = 20 * 60 * 1000;
const deliverySpeeds = new Set<DeliverySpeed>(['standard', 'priority']);

quotesRouter.get('/payment-options', (_req, res) => {
  res.json(store.findPaymentOptions().filter((option) => option.enabled));
});

quotesRouter.get('/fee-schedule', (_req, res) => {
  res.json(getFeeSchedule());
});

quotesRouter.get('/delivery-methods', (_req, res) => {
  res.json(store.findDeliveryMethods().filter((method) => method.active));
});

quotesRouter.get('/service-announcements', (_req, res) => {
  const now = Date.now();
  res.json(store.findServiceAnnouncements().filter((announcement) => (
    announcement.active
    && Date.parse(announcement.startsAt) <= now
    && Date.parse(announcement.endsAt) > now
  )));
});

quotesRouter.post('/quotes', (req, res) => {
  const parsed = quoteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de cotización inválidos',
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const {
    amountDelivered,
    deliverySpeed,
    paymentOptionId,
    deliveryMethod,
    municipality,
  } = parsed.data;
  const paymentOption = store.findPaymentOptionById(paymentOptionId);
  const deliveryMethodOption = store.findDeliveryMethodById(deliveryMethod);

  if (!deliverySpeeds.has(deliverySpeed)) {
    return res.status(400).json({ error: 'Velocidad de entrega inválida' });
  }
  if (!paymentOption?.enabled) {
    return res.status(400).json({ error: 'Opción de pago no disponible' });
  }
  if (!deliveryMethodOption?.active || deliveryMethodOption.zone !== municipality) {
    return res.status(400).json({ error: 'Método de entrega no disponible en esta zona' });
  }
  if (
    amountDelivered < deliveryMethodOption.minAmount
    || amountDelivered > deliveryMethodOption.maxAmount
  ) {
    return res.status(400).json({ error: 'Monto fuera de los límites del método de entrega' });
  }
  if (
    amountDelivered < paymentOption.minAmountUsd
    || amountDelivered > paymentOption.maxAmountUsd
  ) {
    return res.status(400).json({ error: 'Monto fuera de los límites de esta opción de pago' });
  }

  const calculated = calculateQuote({
    amountDelivered,
    deliverySpeed,
    deliveryFee: deliveryMethodOption.fee,
    estimatedMinHours: deliveryMethodOption.estimatedMinHours,
    estimatedMaxHours: deliveryMethodOption.estimatedMaxHours,
  });
  const now = new Date();
  const quote: Quote = {
    id: crypto.randomUUID(),
    ...calculated,
    deliveryMethod: deliveryMethodOption.code,
    municipality,
    deliverySpeed,
    paymentOptionId: paymentOption.id,
    paymentAsset: paymentOption.asset,
    paymentNetwork: paymentOption.network,
    status: 'active',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
  };
  store.saveQuote(quote);

  return res.status(201).json({
    quoteId: quote.id,
    amountDelivered: quote.amountDelivered,
    serviceFee: quote.serviceFee,
    deliveryFee: quote.deliveryFee,
    totalToPayUsd: quote.totalToPay,
    feePercentage: quote.feePercentage,
    estimatedDelivery: quote.estimatedDelivery,
    expiresAt: quote.expiresAt,
    paymentOption,
    deliveryMethod: deliveryMethodOption,
  });
});
