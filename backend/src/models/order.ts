export type PaymentMethod = 'usdt' | 'euro';
export type PaymentStatus =
  | 'pending_wallet'
  | 'awaiting_payment'
  | 'detected'
  | 'confirming'
  | 'underpaid'
  | 'payment_review'
  | 'confirmed'
  | 'notified'
  | 'swept'
  | 'ready_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'expired'
  | 'contact_whatsapp';
export type DeliverySpeed = 'standard' | 'priority';
export type DeliveryStatus =
  | 'unassigned'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface Agent {
  id: string;
  name: string;
  phone: string;
  zone: string;
  active: boolean;
  createdAt: string;
}

export interface RemittanceQuote {
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPay: number;
  feePercentage: number;
  estimatedDelivery: string;
}

export interface PaymentOption {
  id: string;
  provider: 'trondealer' | 'manual';
  asset: string;
  network: string;
  enabled: boolean;
  stablecoin: boolean;
  addressType: 'evm' | 'tron' | 'solana' | 'bitcoin' | 'ton' | 'other';
  minAmountUsd: number;
  maxAmountUsd: number;
  minConfirmations: number;
  estimatedConfirmationTime: string;
  warning: string;
}

export interface DeliveryMethod {
  id: string;
  code: string;
  name: string;
  currency: 'USD' | 'EUR' | 'CUP' | 'MLC';
  type: 'cash' | 'bank_transfer' | 'card_topup' | 'balance';
  zone: string;
  active: boolean;
  minAmount: number;
  maxAmount: number;
  fee: number;
  estimatedMinHours: number;
  estimatedMaxHours: number;
  description: string;
}

export interface ServiceAnnouncement {
  id: string;
  message: string;
  type: 'info' | 'promotion' | 'warning';
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface Quote extends RemittanceQuote {
  id: string;
  deliveryMethod: string;
  municipality: string;
  deliverySpeed: DeliverySpeed;
  paymentOptionId: string;
  paymentAsset: string;
  paymentNetwork: string;
  status: 'active' | 'consumed' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
}

export interface PaymentIntent {
  id: string;
  orderReference: string;
  provider: 'trondealer' | 'manual';
  asset: string;
  network: string;
  address: string;
  addressType: PaymentOption['addressType'];
  amountDueUsd: number;
  amountDueNative?: string;
  amountReceivedUsd: number;
  amountReceivedNative?: string;
  priceUsd?: number;
  status:
    | 'created'
    | 'awaiting_payment'
    | 'detected'
    | 'confirming'
    | 'confirmed'
    | 'swept'
    | 'underpaid'
    | 'overpaid'
    | 'review'
    | 'expired';
  confirmations: number;
  minConfirmations: number;
  expiresAt: string;
  quoteLockedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  deduplicationKey: string;
  provider: 'trondealer';
  eventType:
    | 'transaction.incoming'
    | 'transaction.confirmation_update'
    | 'transaction.confirmed'
    | 'transaction.swept'
    | 'legacy.notified'
    | 'unknown';
  providerStatus?: string;
  txHash: string;
  outputIndex: string;
  asset: string;
  network: string;
  amountUsd?: number;
  amountNative?: string;
  priceUsd?: number;
  confirmations?: number;
  minConfirmations?: number;
  occurredAt?: string;
  receivedAt: string;
}

export interface ProviderWebhookEvent {
  deduplicationKey: string;
  label: string;
  event: PaymentEvent;
  outcome: 'applied' | 'unknown' | 'order_not_found';
}

export interface NotificationEvent {
  id: string;
  orderReference: string;
  eventType: 'delivery_assigned_admin' | 'delivery_assigned_sender';
  template: string;
  recipient: string;
  payload: Record<string, string>;
  status: 'pending' | 'sent' | 'failed' | 'retrying' | 'cancelled';
  attempts: number;
  providerMessageId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
}

export interface Order {
  reference: string;
  quoteId?: string;
  quoteExpiresAt?: string;
  paymentIntentId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliverySpeed: DeliverySpeed;
  quote: RemittanceQuote;
  senderName: string;
  senderPhone: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  municipality: string;
  address: string;
  notes: string;
  tronWalletAddress?: string;
  txHash?: string;
  paidAmount?: number;
  paidAmountNative?: string;
  paidAsset?: string;
  paidPriceUsd?: number;
  paymentVarianceUsd?: number;
  paymentExcessUsd?: number;
  paidNetwork?: string;
  confirmations?: number;
  minConfirmations?: number;
  confirmationProgress?: number;
  paymentDetectedAt?: string;
  paymentConfirmedAt?: string;
  paymentSweptAt?: string;
  lastPaymentEventAt?: string;
  trackingTokenHash?: string;
  deliveryStatus?: DeliveryStatus;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  isSurprise?: boolean;
  notifySender?: boolean;
  notifyBeneficiary?: boolean;
  senderChatId?: string;
  paymentEvents?: PaymentEvent[];
}
