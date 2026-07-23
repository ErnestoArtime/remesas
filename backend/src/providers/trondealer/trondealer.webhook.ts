import type { Order, PaymentStatus } from '../../models/order';
import type {
  NormalizedPaymentEvent,
  PaymentEventApplication,
} from './trondealer.types';

const STATUS_RANK: Partial<Record<PaymentStatus, number>> = {
  pending_wallet: 0,
  awaiting_payment: 1,
  detected: 2,
  confirming: 3,
  underpaid: 3.5,
  payment_review: 3.5,
  confirmed: 4,
  notified: 5,
  swept: 6,
  ready_for_delivery: 7,
  delivered: 8,
  cancelled: 8,
  expired: 8,
};

function rank(status: PaymentStatus): number {
  return STATUS_RANK[status] ?? 0;
}

function advance(order: Order, target: PaymentStatus): boolean {
  if (rank(target) <= rank(order.paymentStatus)) return false;
  order.paymentStatus = target;
  return true;
}

function updatePaymentMetadata(order: Order, event: NormalizedPaymentEvent): void {
  if (event.txHash) order.txHash = event.txHash;
  if (event.amountUsd !== undefined) order.paidAmount = event.amountUsd;
  if (event.amountNative !== undefined) order.paidAmountNative = event.amountNative;
  if (event.asset) order.paidAsset = event.asset;
  if (event.priceUsd !== undefined) order.paidPriceUsd = event.priceUsd;
  if (event.network) order.paidNetwork = event.network;

  order.confirmations = Math.max(order.confirmations ?? 0, event.confirmations ?? 0);
  order.minConfirmations = Math.max(order.minConfirmations ?? 0, event.minConfirmations ?? 0);

  if ((order.minConfirmations ?? 0) > 0) {
    order.confirmationProgress = Math.min(
      (order.confirmations ?? 0) / order.minConfirmations!,
      1,
    );
  }
}

function settleConfirmedStatus(
  order: Order,
  target: 'confirmed' | 'notified' | 'swept',
): boolean {
  if (rank(order.paymentStatus) >= rank(target)) return false;

  if (order.quoteExpiresAt && Date.parse(order.quoteExpiresAt) < Date.now()) {
    return advance(order, 'payment_review');
  }

  const paidAmount = Number(order.paidAmount);
  if (!Number.isFinite(paidAmount)) {
    return advance(order, 'payment_review');
  }
  const configuredTolerance = Number(process.env.PAYMENT_TOLERANCE_USD ?? '0.05');
  const toleranceUsd = Number.isFinite(configuredTolerance) && configuredTolerance >= 0
    ? configuredTolerance
    : 0.05;
  const varianceUsd = Math.round((paidAmount - order.quote.totalToPay) * 100) / 100;
  order.paymentVarianceUsd = varianceUsd;
  order.paymentExcessUsd = varianceUsd > toleranceUsd ? varianceUsd : 0;

  if (varianceUsd < -toleranceUsd) {
    return advance(order, 'underpaid');
  }
  return advance(order, target);
}

export function applyTronDealerEvent(
  order: Order,
  event: NormalizedPaymentEvent,
  receivedAt = new Date().toISOString(),
): PaymentEventApplication {
  const previousStatus = order.paymentStatus;

  if (event.eventType !== 'unknown') {
    updatePaymentMetadata(order, event);
    order.lastPaymentEventAt = receivedAt;
  }

  switch (event.eventType) {
    case 'transaction.incoming':
      advance(order, 'detected');
      order.paymentDetectedAt ||= event.occurredAt || receivedAt;
      break;
    case 'transaction.confirmation_update':
      if (rank(order.paymentStatus) < rank('confirmed')) {
        advance(order, 'confirming');
      }
      order.paymentDetectedAt ||= event.occurredAt || receivedAt;
      break;
    case 'transaction.confirmed':
      settleConfirmedStatus(order, 'confirmed');
      if (rank(order.paymentStatus) >= rank('confirmed')) {
        order.paymentConfirmedAt ||= event.occurredAt || receivedAt;
      }
      break;
    case 'legacy.notified':
      settleConfirmedStatus(order, 'notified');
      if (rank(order.paymentStatus) >= rank('confirmed')) {
        order.paymentConfirmedAt ||= event.occurredAt || receivedAt;
      }
      break;
    case 'transaction.swept':
      settleConfirmedStatus(order, 'swept');
      if (order.paymentStatus === 'swept') {
        order.paymentSweptAt ||= event.occurredAt || receivedAt;
      }
      break;
    case 'unknown':
      break;
  }

  return {
    changed: previousStatus !== order.paymentStatus,
    paymentStatus: order.paymentStatus,
  };
}
