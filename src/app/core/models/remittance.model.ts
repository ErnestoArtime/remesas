export type DeliveryZone = 'havana';
export type DeliverySpeed = 'standard' | 'priority';
export type PaymentMethod = 'usdt' | 'euro';

export interface QuoteRequest {
  amount: number;
  zone: DeliveryZone;
  speed: DeliverySpeed;
  paymentOptionId: string;
  deliveryMethod: string;
}

export interface PaymentOption {
  id: string;
  provider: 'trondealer' | 'manual';
  asset: string;
  network: string;
  enabled: boolean;
  stablecoin: boolean;
  addressType: string;
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

export interface FeeTier {
  minimum: number;
  maximum: number;
  percentage: number;
  minimumFee: number;
}

export interface RemittanceQuote {
  quoteId: string;
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPay: number;
  feePercentage: number;
  estimatedDelivery: string;
  expiresAt: string;
  paymentOption: PaymentOption;
  paymentAsset?: string;
  paymentNetwork?: string;
}

export interface RemittanceOrder {
  reference: string;
  quote: RemittanceQuote;
  senderName: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  municipality: string;
  createdAt: string;
  paymentStatus: 'pending_wallet' | 'awaiting_payment' | 'detected' | 'confirming' | 'underpaid' | 'payment_review' | 'confirmed' | 'notified' | 'swept' | 'ready_for_delivery' | 'delivered' | 'cancelled' | 'expired' | 'contact_whatsapp';
  paymentMethod: PaymentMethod;
  tronWalletAddress?: string;
  txHash?: string;
  paidAmount?: number;
  paidAsset?: string;
  paidNetwork?: string;
  trackingToken: string;
}
