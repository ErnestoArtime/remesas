import type { PaymentEvent, PaymentStatus } from '../../models/order';

export type TronDealerEventType =
  | 'transaction.incoming'
  | 'transaction.confirmation_update'
  | 'transaction.confirmed'
  | 'transaction.swept'
  | 'legacy.notified'
  | 'unknown';

export interface NormalizedPaymentEvent {
  provider: 'trondealer';
  eventType: TronDealerEventType;
  providerStatus?: string;
  label: string;
  txHash: string;
  outputIndex: string;
  asset: string;
  network: string;
  amountUsd?: number;
  amountNative?: string;
  priceUsd?: number;
  confirmations?: number;
  minConfirmations?: number;
  fromAddress?: string;
  toAddress?: string;
  occurredAt?: string;
  deduplicationKey: string;
  rawPayload: unknown;
}
export interface PaymentEventApplication {
  changed: boolean;
  paymentStatus: PaymentStatus;
}

export function toPaymentEvent(
  event: NormalizedPaymentEvent,
  receivedAt: string,
): PaymentEvent {
  return {
    deduplicationKey: event.deduplicationKey,
    provider: event.provider,
    eventType: event.eventType,
    providerStatus: event.providerStatus,
    txHash: event.txHash,
    outputIndex: event.outputIndex,
    asset: event.asset,
    network: event.network,
    amountUsd: event.amountUsd,
    amountNative: event.amountNative,
    priceUsd: event.priceUsd,
    confirmations: event.confirmations,
    minConfirmations: event.minConfirmations,
    occurredAt: event.occurredAt,
    receivedAt,
  };
}
