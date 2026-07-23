import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  DeliveryMethod,
  FeeTier,
  PaymentOption,
  QuoteRequest,
  RemittanceQuote,
  ServiceAnnouncement,
} from '../models/remittance.model';

interface QuoteApiResponse {
  quoteId: string;
  amountDelivered: number;
  serviceFee: number;
  deliveryFee: number;
  totalToPayUsd: number;
  feePercentage: number;
  estimatedDelivery: string;
  expiresAt: string;
  paymentOption: PaymentOption;
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);

  getPaymentOptions(): Observable<PaymentOption[]> {
    return this.http.get<PaymentOption[]>('/api/payment-options');
  }

  getDeliveryMethods(): Observable<DeliveryMethod[]> {
    return this.http.get<DeliveryMethod[]>('/api/delivery-methods');
  }

  getServiceAnnouncements(): Observable<ServiceAnnouncement[]> {
    return this.http.get<ServiceAnnouncement[]>('/api/service-announcements');
  }

  getFeeSchedule(): Observable<FeeTier[]> {
    return this.http.get<FeeTier[]>('/api/fee-schedule');
  }

  calculate(request: QuoteRequest): Observable<RemittanceQuote> {
    return this.http.post<QuoteApiResponse>('/api/quotes', {
      amountDelivered: Number(request.amount),
      deliveryMethod: request.deliveryMethod,
      municipality: request.zone,
      deliverySpeed: request.speed,
      paymentOptionId: request.paymentOptionId,
    }).pipe(
      map((quote) => ({
        quoteId: quote.quoteId,
        amountDelivered: quote.amountDelivered,
        serviceFee: quote.serviceFee,
        deliveryFee: quote.deliveryFee,
        totalToPay: quote.totalToPayUsd,
        feePercentage: quote.feePercentage,
        estimatedDelivery: quote.estimatedDelivery,
        expiresAt: quote.expiresAt,
        paymentOption: quote.paymentOption,
      })),
    );
  }
}
