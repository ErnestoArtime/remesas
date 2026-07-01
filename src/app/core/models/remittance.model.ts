export type DeliveryZone = 'havana';
export type DeliverySpeed = 'standard' | 'priority';
export type PaymentMethod = 'usdt' | 'euro';

export interface QuoteRequest {
  amount: number;
  zone: DeliveryZone;
  speed: DeliverySpeed;
  paymentMethod: PaymentMethod;
}

export interface RemittanceQuote {
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPay: number;
  feePercentage: number;
  estimatedDelivery: string;
}

export interface RemittanceOrder {
  reference: string;
  quote: RemittanceQuote;
  senderName: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  municipality: string;
  createdAt: string;
  paymentStatus: 'pending_wallet' | 'awaiting_payment' | 'detected' | 'confirmed' | 'notified' | 'swept' | 'ready_for_delivery' | 'delivered' | 'cancelled' | 'expired' | 'contact_whatsapp';
  paymentMethod: PaymentMethod;
  tronWalletAddress?: string;
  txHash?: string;
  paidAmount?: number;
  paidNetwork?: string;
}
