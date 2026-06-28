export type DeliveryZone = 'havana' | 'provincial' | 'remote';
export type DeliverySpeed = 'standard' | 'priority';

export interface QuoteRequest {
  amount: number;
  zone: DeliveryZone;
  speed: DeliverySpeed;
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
  createdAt: Date;
  paymentStatus: 'awaiting_wallet';
}
