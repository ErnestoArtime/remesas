import crypto from 'crypto';
import type { Agent, NotificationEvent, Order } from '../models/order';
import {
  notifyAdminAssignment,
  notifySenderDelivery,
  type OpenWaResult,
  openwaConfig,
} from './openwa';
import { store } from './store';

const MAX_ATTEMPTS = 3;

function createEvent(
  order: Order,
  eventType: NotificationEvent['eventType'],
  recipient: string,
  payload: Record<string, string>,
): NotificationEvent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    orderReference: order.reference,
    eventType,
    template: eventType,
    recipient,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
}
async function send(event: NotificationEvent): Promise<OpenWaResult> {
  if (event.eventType === 'delivery_assigned_admin') {
    return notifyAdminAssignment({
      reference: event.orderReference,
      beneficiaryName: event.payload.beneficiaryName || '',
      municipality: event.payload.municipality || '',
      assignedAgentName: event.payload.assignedAgentName || '',
    });
  }
  return notifySenderDelivery({
    reference: event.orderReference,
    beneficiaryName: event.payload.beneficiaryName || '',
    municipality: event.payload.municipality || '',
    assignedAgentName: event.payload.assignedAgentName || '',
    senderName: event.payload.senderName || '',
    senderChatId: event.recipient,
  });
}

export async function processNotification(event: NotificationEvent): Promise<void> {
  if (event.status === 'sent' || event.status === 'cancelled') return;

  event.attempts += 1;
  event.status = event.attempts > 1 ? 'retrying' : 'pending';
  event.updatedAt = new Date().toISOString();
  store.saveNotificationEvent(event);

  const result = await send(event);
  if (result.ok) {
    event.status = 'sent';
    event.sentAt = new Date().toISOString();
    event.providerMessageId = result.providerMessageId;
    event.error = undefined;
  } else {
    event.error = result.error || 'openwa-unknown-error';
    event.status = event.attempts >= MAX_ATTEMPTS || result.skipped ? 'failed' : 'retrying';
  }
  event.updatedAt = new Date().toISOString();
  store.saveNotificationEvent(event);

  if (event.status === 'retrying') {
    const delay = event.attempts === 1 ? 5_000 : 30_000;
    setTimeout(() => void processNotification(event), delay).unref();
  }
}

export function enqueueAssignmentNotifications(order: Order, agent: Agent): void {
  const commonPayload = {
    beneficiaryName: order.beneficiaryName,
    municipality: order.municipality,
    assignedAgentName: agent.name,
  };

  if (openwaConfig.adminChatId) {
    const adminEvent = createEvent(
      order,
      'delivery_assigned_admin',
      openwaConfig.adminChatId,
      commonPayload,
    );
    store.saveNotificationEvent(adminEvent);
    queueMicrotask(() => void processNotification(adminEvent));
  }

  if (order.notifySender && order.senderChatId) {
    const senderEvent = createEvent(
      order,
      'delivery_assigned_sender',
      order.senderChatId,
      { ...commonPayload, senderName: order.senderName },
    );
    store.saveNotificationEvent(senderEvent);
    queueMicrotask(() => void processNotification(senderEvent));
  }
}

export function resumeNotificationQueue(): void {
  for (const event of store.findNotificationEvents()) {
    if (event.status === 'pending' || event.status === 'retrying') {
      queueMicrotask(() => void processNotification(event));
    }
  }
}
