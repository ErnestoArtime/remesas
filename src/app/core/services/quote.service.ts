import { Injectable } from '@angular/core';
import {
  DeliverySpeed,
  DeliveryZone,
  QuoteRequest,
  RemittanceQuote,
} from '../models/remittance.model';

interface FeeTier {
  maximum: number;
  percentage: number;
  minimumFee: number;
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly feeTiers: FeeTier[] = [
    { maximum: 99.99, percentage: 8, minimumFee: 5 },
    { maximum: 299.99, percentage: 6.5, minimumFee: 0 },
    { maximum: 699.99, percentage: 5, minimumFee: 0 },
    { maximum: 1500, percentage: 4, minimumFee: 0 },
  ];

  private readonly deliveryFees: Record<DeliveryZone, number> = {
    havana: 3,
    provincial: 6,
    remote: 10,
  };

  calculate(request: QuoteRequest): RemittanceQuote {
    const amount = Math.min(Math.max(Number(request.amount) || 0, 0), 1500);
    const tier = this.feeTiers.find((item) => amount <= item.maximum) ?? this.feeTiers.at(-1)!;
    const serviceFee = Math.max((amount * tier.percentage) / 100, tier.minimumFee);
    const priorityFee = request.speed === 'priority' ? 5 : 0;
    const deliveryFee = this.deliveryFees[request.zone] + priorityFee;

    return {
      amountDelivered: this.round(amount),
      serviceFee: this.round(serviceFee),
      deliveryFee: this.round(deliveryFee),
      totalToPay: this.round(amount + serviceFee + deliveryFee),
      feePercentage: tier.percentage,
      estimatedDelivery: this.getDeliveryEstimate(request.zone, request.speed),
    };
  }

  private getDeliveryEstimate(zone: DeliveryZone, speed: DeliverySpeed): string {
    if (speed === 'priority') {
      return zone === 'havana' ? 'Hasta 6 horas' : 'En 24 horas';
    }

    return zone === 'havana' ? 'En 24 horas' : 'De 1 a 3 días';
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
