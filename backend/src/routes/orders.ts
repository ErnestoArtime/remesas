import crypto from 'crypto';
import { Router } from 'express';
import { Order } from '../models/order';
import { store } from '../services/store';
import { tronService } from '../services/trondealer';
import { toPublicOrderStatus } from '../services/public-order';
import { createTrackingToken, verifyTrackingToken } from '../services/tracking';
import { normalizePhoneE164, toOpenWaChatId } from '../services/phone';
import { createOrderSchema } from '../validation/schemas';

export const ordersRouter = Router();

function generateReference(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `RC-${year}-${suffix}`;
}

ordersRouter.post('/orders', async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de la remesa inválidos',
        issues: parsed.error.issues.map((issue) => issue.message),
      });
    }
    const {
      paymentMethod,
      quoteId,
      senderName,
      senderPhone,
      beneficiaryName,
      beneficiaryPhone,
      municipality,
      address,
      notes,
      isSurprise,
      whatsappConsent,
    } = parsed.data;

    if (!senderName || !beneficiaryName || !municipality) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const lockedQuote = store.findQuoteById(String(quoteId || ''));
    if (!lockedQuote || lockedQuote.status !== 'active') {
      return res.status(409).json({ error: 'La cotización no existe o ya fue utilizada' });
    }
    if (Date.parse(lockedQuote.expiresAt) <= Date.now()) {
      lockedQuote.status = 'expired';
      store.saveQuote(lockedQuote);
      return res.status(409).json({ error: 'La cotización ha vencido; genera una nueva' });
    }

    const paymentOption = store.findPaymentOptionById(lockedQuote.paymentOptionId);
    if (!paymentOption?.enabled) {
      return res.status(409).json({ error: 'La opción de pago ya no está disponible' });
    }

    const expectedPaymentMethod = paymentOption.provider === 'manual' ? 'euro' : 'usdt';
    if (paymentMethod && paymentMethod !== expectedPaymentMethod) {
      return res.status(400).json({ error: 'El método de pago no coincide con la cotización' });
    }

    const reference = generateReference();
    const tracking = createTrackingToken();
    const paymentStatus = expectedPaymentMethod === 'euro' ? 'contact_whatsapp' : 'pending_wallet';
    const now = new Date().toISOString();
    const paymentIntentId = crypto.randomUUID();
    let normalizedSenderPhone: string;
    let normalizedBeneficiaryPhone: string;
    try {
      normalizedSenderPhone = normalizePhoneE164(senderPhone);
      normalizedBeneficiaryPhone = normalizePhoneE164(beneficiaryPhone);
    } catch (error) {
      return res.status(400).json({ error: String((error as Error).message) });
    }

    const order: Order = {
      reference,
      quoteId: lockedQuote.id,
      quoteExpiresAt: lockedQuote.expiresAt,
      paymentIntentId,
      paymentMethod: expectedPaymentMethod,
      paymentStatus,
      deliverySpeed: lockedQuote.deliverySpeed,
      quote: lockedQuote,
      senderName,
      senderPhone: normalizedSenderPhone,
      beneficiaryName,
      beneficiaryPhone: normalizedBeneficiaryPhone,
      municipality,
      address,
      notes: notes || '',
      isSurprise: Boolean(isSurprise),
      notifySender: Boolean(whatsappConsent),
      notifyBeneficiary: !Boolean(isSurprise),
      senderChatId: whatsappConsent ? toOpenWaChatId(normalizedSenderPhone) : '',
      trackingTokenHash: tracking.hash,
      paidAsset: paymentOption.asset,
      paidNetwork: paymentOption.network,
      confirmations: 0,
      minConfirmations: paymentOption.minConfirmations,
      confirmationProgress: 0,
      deliveryStatus: 'unassigned',
      createdAt: now,
    };

    if (expectedPaymentMethod === 'usdt' && tronService.checkConfig()) {
      try {
        const wallet = await tronService.assignWallet(reference);
        order.tronWalletAddress = wallet;
        order.paymentStatus = 'awaiting_payment';
      } catch (err) {
        console.error('Error asignando wallet TronDealer:', err);
      }
    }

    store.savePaymentIntent({
      id: paymentIntentId,
      orderReference: reference,
      provider: paymentOption.provider,
      asset: paymentOption.asset,
      network: paymentOption.network,
      address: order.tronWalletAddress || '',
      addressType: paymentOption.addressType,
      amountDueUsd: lockedQuote.totalToPay,
      amountReceivedUsd: 0,
      status: order.paymentStatus === 'awaiting_payment' ? 'awaiting_payment' : 'created',
      confirmations: 0,
      minConfirmations: paymentOption.minConfirmations,
      expiresAt: lockedQuote.expiresAt,
      quoteLockedAt: lockedQuote.createdAt,
      createdAt: now,
      updatedAt: now,
    });

    lockedQuote.status = 'consumed';
    store.saveQuote(lockedQuote);
    store.save(order);
    const { trackingTokenHash: _trackingTokenHash, paymentEvents: _paymentEvents, ...publicOrder } = order;
    res.status(201).json({ ...publicOrder, trackingToken: tracking.token });
  } catch (err) {
    console.error('Error creando orden:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

ordersRouter.get('/public/orders/:reference/status', (req, res) => {
  const order = store.findByReference(req.params.reference);
  const authorization = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const headerToken = typeof req.headers['x-tracking-token'] === 'string'
    ? req.headers['x-tracking-token']
    : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const token = authorization || headerToken || queryToken;

  if (!order?.trackingTokenHash || !verifyTrackingToken(token, order.trackingTokenHash)) {
    return res.status(404).json({ error: 'Seguimiento no encontrado' });
  }

  res.json(toPublicOrderStatus(order));
});
