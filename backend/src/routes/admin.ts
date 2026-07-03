import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { Agent, DeliveryStatus, PaymentStatus } from '../models/order';
import { store } from '../services/store';
import { notifyAdminAssignment, notifySenderDelivery } from '../services/openwa';

export const adminRouter = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const assignablePaymentStatuses = new Set<PaymentStatus>([
  'confirmed',
  'notified',
  'swept',
  'ready_for_delivery',
]);
const deliveryStatuses = new Set<DeliveryStatus>([
  'assigned',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled',
]);

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const provided = Buffer.from(token);
  const expected = Buffer.from(ADMIN_API_KEY);

  if (!ADMIN_API_KEY || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: 'Acceso administrativo no autorizado' });
    return;
  }

  next();
}

adminRouter.use(requireAdmin);

adminRouter.get('/orders', (_req, res) => {
  const orders = store
    .findAll()
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  res.json(orders);
});

adminRouter.get('/agents', (_req, res) => {
  res.json(store.findAgents().sort((first, second) => first.name.localeCompare(second.name)));
});

adminRouter.post('/agents', (req, res) => {
  const { name, phone, zone } = req.body;
  if (!name?.trim() || !phone?.trim() || !zone?.trim()) {
    res.status(400).json({ error: 'Nombre, teléfono y zona son obligatorios' });
    return;
  }

  const agent: Agent = {
    id: crypto.randomUUID(),
    name: name.trim(),
    phone: phone.trim(),
    zone: zone.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.saveAgent(agent);
  res.status(201).json(agent);
});

adminRouter.patch('/agents/:id', (req, res) => {
  const agent = store.findAgentById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agente no encontrado' });
    return;
  }

  if (typeof req.body.active === 'boolean') agent.active = req.body.active;
  store.saveAgent(agent);
  res.json(agent);
});

adminRouter.patch('/orders/:reference/assign', (req, res) => {
  const order = store.findByReference(req.params.reference);
  const agent = store.findAgentById(req.body.agentId);

  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }
  if (!agent || !agent.active) {
    res.status(400).json({ error: 'Selecciona un agente activo' });
    return;
  }
  if (!assignablePaymentStatuses.has(order.paymentStatus)) {
    res.status(409).json({ error: 'El pago debe estar confirmado antes de asignar la entrega' });
    return;
  }

  order.assignedAgentId = agent.id;
  order.assignedAgentName = agent.name;
  order.assignedAt = new Date().toISOString();
  order.deliveryStatus = 'assigned';
  store.save(order);

  notifyAdminAssignment({
    reference: order.reference,
    beneficiaryName: order.beneficiaryName,
    municipality: order.municipality,
    assignedAgentName: agent.name,
  });

  if (!order.isSurprise && order.senderChatId) {
    notifySenderDelivery({
      reference: order.reference,
      beneficiaryName: order.beneficiaryName,
      municipality: order.municipality,
      assignedAgentName: agent.name,
      senderName: order.senderName,
      senderChatId: order.senderChatId,
    });
  }

  res.json(order);
});

adminRouter.patch('/orders/:reference/payment-status', (req, res) => {
  const order = store.findByReference(req.params.reference);
  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }
  if (order.paymentMethod !== 'euro' || order.paymentStatus !== 'contact_whatsapp') {
    res.status(409).json({ error: 'Sólo se pueden confirmar manualmente pagos EUR pendientes' });
    return;
  }

  order.paymentStatus = 'confirmed';
  store.save(order);
  res.json(order);
});

adminRouter.patch('/orders/:reference/delivery-fee', (req, res) => {
  const order = store.findByReference(req.params.reference);
  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }

  const fee = Number(req.body.deliveryFee);
  if (!Number.isFinite(fee) || fee < 0) {
    res.status(400).json({ error: 'El costo de entrega debe ser un número válido mayor o igual a 0' });
    return;
  }

  order.quote.deliveryFee = Math.round(fee * 100) / 100;
  order.quote.totalToPay = Math.round((order.quote.amountDelivered + order.quote.serviceFee + order.quote.deliveryFee) * 100) / 100;
  store.save(order);
  res.json(order);
});

adminRouter.patch('/orders/:reference/delivery-status', (req, res) => {
  const order = store.findByReference(req.params.reference);
  const status = req.body.status as DeliveryStatus;

  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }
  if (!deliveryStatuses.has(status)) {
    res.status(400).json({ error: 'Estado de entrega inválido' });
    return;
  }
  if (!order.assignedAgentId && status !== 'cancelled') {
    res.status(409).json({ error: 'La orden debe tener un agente asignado' });
    return;
  }

  order.deliveryStatus = status;
  if (status === 'delivered') {
    order.deliveredAt = new Date().toISOString();
    order.paymentStatus = 'delivered';
  }
  store.save(order);
  res.json(order);
});
