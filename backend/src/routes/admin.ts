import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { Agent, DeliveryStatus, PaymentStatus, ServiceAnnouncement } from '../models/order';
import { store } from '../services/store';
import {
  agentCreateSchema,
  agentPatchSchema,
  assignmentSchema,
  deliveryFeeSchema,
  deliveryMethodPatchSchema,
  deliveryStatusSchema,
  paymentOptionPatchSchema,
  serviceAnnouncementPatchSchema,
  serviceAnnouncementSchema,
} from '../validation/schemas';
import { enqueueAssignmentNotifications } from '../services/notifications';
import { buildReconciliationSnapshot } from '../services/reconciliation';

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

function audit(
  action: string,
  entityType: string,
  entityId: string,
  beforeData?: unknown,
  afterData?: unknown,
): void {
  store.saveAuditLog({
    id: crypto.randomUUID(),
    actor: 'admin-api-key',
    action,
    entityType,
    entityId,
    beforeData,
    afterData,
    createdAt: new Date().toISOString(),
  });
}

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

adminRouter.get('/payment-options', (_req, res) => {
  res.json(store.findPaymentOptions());
});

adminRouter.get('/notifications', (req, res) => {
  const reference = typeof req.query.reference === 'string' ? req.query.reference : undefined;
  res.json(store.findNotificationEvents(reference));
});

adminRouter.get('/audit-logs', (_req, res) => {
  res.json(store.findAuditLogs().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

adminRouter.get('/reconciliation', (_req, res) => {
  res.json(buildReconciliationSnapshot(
    store.findAll(),
    store.findPaymentIntents(),
    store.findWebhookEvents(),
    store.findNotificationEvents(),
  ));
});

adminRouter.get('/delivery-methods', (_req, res) => {
  res.json(store.findDeliveryMethods());
});

adminRouter.patch('/delivery-methods/:id', (req, res) => {
  const method = store.findDeliveryMethodById(req.params.id);
  if (!method) {
    res.status(404).json({ error: 'Método de entrega no encontrado' });
    return;
  }
  const parsed = deliveryMethodPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Configuración de entrega inválida' });
    return;
  }
  const updated = { ...method, ...parsed.data };
  if (
    updated.maxAmount < updated.minAmount
    || updated.estimatedMaxHours < updated.estimatedMinHours
  ) {
    res.status(400).json({ error: 'Los rangos configurados no son válidos' });
    return;
  }
  store.saveDeliveryMethod(updated);
  audit('delivery_method.updated', 'delivery_method', method.id, method, updated);
  res.json(updated);
});

adminRouter.get('/service-announcements', (_req, res) => {
  res.json(store.findServiceAnnouncements());
});

adminRouter.post('/service-announcements', (req, res) => {
  const parsed = serviceAnnouncementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Aviso de servicio inválido' });
    return;
  }
  const announcement: ServiceAnnouncement = {
    id: crypto.randomUUID(),
    ...parsed.data,
  };
  store.saveServiceAnnouncement(announcement);
  audit('service_announcement.created', 'service_announcement', announcement.id, undefined, announcement);
  res.status(201).json(announcement);
});

adminRouter.patch('/service-announcements/:id', (req, res) => {
  const announcement = store.findServiceAnnouncementById(req.params.id);
  if (!announcement) {
    res.status(404).json({ error: 'Aviso de servicio no encontrado' });
    return;
  }
  const parsed = serviceAnnouncementPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Aviso de servicio inválido' });
    return;
  }
  const updated = { ...announcement, ...parsed.data };
  if (Date.parse(updated.endsAt) <= Date.parse(updated.startsAt)) {
    res.status(400).json({ error: 'La fecha final debe ser posterior a la inicial' });
    return;
  }
  store.saveServiceAnnouncement(updated);
  audit('service_announcement.updated', 'service_announcement', announcement.id, announcement, updated);
  res.json(updated);
});

adminRouter.patch('/payment-options/:id', (req, res) => {
  const option = store.findPaymentOptionById(req.params.id);
  if (!option) {
    res.status(404).json({ error: 'Opción de pago no encontrada' });
    return;
  }
  const parsed = paymentOptionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Configuración de pago inválida',
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }
  const before = { ...option };
  Object.assign(option, parsed.data);
  if (option.maxAmountUsd < option.minAmountUsd) {
    res.status(400).json({ error: 'El máximo debe ser mayor o igual al mínimo' });
    return;
  }
  store.savePaymentOption(option);
  audit('payment_option.updated', 'payment_option', option.id, before, option);
  res.json(option);
});

adminRouter.post('/agents', (req, res) => {
  const parsed = agentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nombre, teléfono y zona son obligatorios' });
    return;
  }
  const { name, phone, zone } = parsed.data;

  const agent: Agent = {
    id: crypto.randomUUID(),
    name: name.trim(),
    phone: phone.trim(),
    zone: zone.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.saveAgent(agent);
  audit('agent.created', 'agent', agent.id, undefined, agent);
  res.status(201).json(agent);
});

adminRouter.patch('/agents/:id', (req, res) => {
  const agent = store.findAgentById(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agente no encontrado' });
    return;
  }

  const parsed = agentPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Estado de agente inválido' });
    return;
  }
  const before = { ...agent };
  agent.active = parsed.data.active;
  store.saveAgent(agent);
  audit('agent.updated', 'agent', agent.id, before, agent);
  res.json(agent);
});

adminRouter.patch('/orders/:reference/assign', (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Identificador de agente inválido' });
    return;
  }
  const order = store.findByReference(req.params.reference);
  const agent = store.findAgentById(parsed.data.agentId);

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
  audit('order.assigned', 'order', order.reference, undefined, {
    assignedAgentId: agent.id,
    deliveryStatus: order.deliveryStatus,
  });

  enqueueAssignmentNotifications(order, agent);

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
  audit('order.manual_payment_confirmed', 'order', order.reference, 'contact_whatsapp', 'confirmed');
  res.json(order);
});

adminRouter.patch('/orders/:reference/delivery-fee', (req, res) => {
  const order = store.findByReference(req.params.reference);
  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }
  if (
    order.quoteId
    || order.tronWalletAddress
    || order.paymentStatus !== 'pending_wallet'
  ) {
    res.status(409).json({
      error: 'El total está bloqueado; genera una nueva cotización en lugar de modificarlo',
    });
    return;
  }

  const parsed = deliveryFeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'El costo de entrega debe ser un número válido mayor o igual a 0' });
    return;
  }
  const fee = parsed.data.deliveryFee;

  const previousDeliveryFee = order.quote.deliveryFee;
  order.quote.deliveryFee = Math.round(fee * 100) / 100;
  order.quote.totalToPay = Math.round((order.quote.amountDelivered + order.quote.serviceFee + order.quote.deliveryFee) * 100) / 100;
  store.save(order);
  audit('order.delivery_fee_updated', 'order', order.reference, previousDeliveryFee, order.quote.deliveryFee);
  res.json(order);
});

adminRouter.patch('/orders/:reference/delivery-status', (req, res) => {
  const order = store.findByReference(req.params.reference);
  const parsed = deliveryStatusSchema.safeParse(req.body);
  const status = parsed.success ? parsed.data.status : undefined;

  if (!order) {
    res.status(404).json({ error: 'Orden no encontrada' });
    return;
  }
  if (!status || !deliveryStatuses.has(status)) {
    res.status(400).json({ error: 'Estado de entrega inválido' });
    return;
  }
  if (!order.assignedAgentId && status !== 'cancelled') {
    res.status(409).json({ error: 'La orden debe tener un agente asignado' });
    return;
  }

  const previousDeliveryStatus = order.deliveryStatus;
  order.deliveryStatus = status;
  if (status === 'delivered') {
    order.deliveredAt = new Date().toISOString();
    order.paymentStatus = 'delivered';
  }
  store.save(order);
  audit('order.delivery_status_updated', 'order', order.reference, previousDeliveryStatus, status);
  res.json(order);
});
