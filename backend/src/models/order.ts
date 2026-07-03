export type PaymentMethod = 'usdt' | 'euro';
export type PaymentStatus =
  | 'pending_wallet'
  | 'awaiting_payment'
  | 'detected'
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

export interface PaymentEvent {
  txHash: string;
  logIndex: string;
  status: string;
  amount: string;
  network: string;
  rawBody: string;
  signature: string;
  receivedAt: string;
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
  deliveryStatus?: DeliveryStatus;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  isSurprise?: boolean;
  senderChatId?: string;
  paymentEvents?: PaymentEvent[];
}
