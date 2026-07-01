export type PaymentMethod = 'usdt' | 'euro';
export type PaymentStatus =
  | 'pending_wallet'
  | 'awaiting_payment'
  | 'detected'
  | 'confirmed'
  | 'notified'
  | 'swept'
  | 'ready_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'expired'
  | 'contact_whatsapp';
export type DeliverySpeed = 'standard' | 'priority';

export interface RemittanceQuote {
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPay: number;
  feePercentage: number;
  estimatedDelivery: string;
}

export interface Order {
  reference: string;
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
  paidNetwork?: string;
  createdAt: string;
}
