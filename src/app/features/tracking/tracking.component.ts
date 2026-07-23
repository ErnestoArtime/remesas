import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, interval, startWith, switchMap, takeWhile } from 'rxjs';

interface PublicOrderStatus {
  reference: string;
  paymentStatus: string;
  deliveryStatus?: string;
  confirmations: number;
  minConfirmations: number;
  confirmationProgress: number;
  amountReceivedUsd?: number;
  asset?: string;
  network?: string;
  txHash?: string;
  explorerUrl?: string;
  estimatedDelivery: string;
  updatedAt: string;
}

const FINAL_PAYMENT_STATES = new Set(['swept', 'delivered', 'cancelled', 'expired']);
const FINAL_DELIVERY_STATES = new Set(['delivered', 'failed', 'cancelled']);

@Component({
  selector: 'app-tracking',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss',
})
export class TrackingComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<PublicOrderStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly progressPercent = computed(
    () => Math.round(Math.min(Math.max(this.status()?.confirmationProgress ?? 0, 0), 1) * 100),
  );

  constructor() {
    const reference = this.route.snapshot.paramMap.get('reference') || '';
    const token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!reference || !token) {
      this.loading.set(false);
      this.error.set('El enlace de seguimiento está incompleto.');
      return;
    }

    interval(7000).pipe(
      startWith(0),
      switchMap(() => this.http.get<PublicOrderStatus>(
        `/api/public/orders/${encodeURIComponent(reference)}/status`,
        { headers: { 'X-Tracking-Token': token } },
      ).pipe(
        catchError(() => {
          this.loading.set(false);
          this.error.set('No se pudo consultar esta remesa. Revisa el enlace o contacta soporte.');
          return EMPTY;
        }),
      )),
      takeWhile((status) => !this.isFinal(status), true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((status) => {
      this.status.update((current) => current ? {
        ...status,
        confirmations: Math.max(current.confirmations, status.confirmations),
        confirmationProgress: Math.max(
          current.confirmationProgress,
          status.confirmationProgress,
        ),
      } : status);
      this.loading.set(false);
      this.error.set('');
    });
  }

  protected paymentReached(stage: string): boolean {
    const rank: Record<string, number> = {
      pending_wallet: 0,
      awaiting_payment: 0,
      detected: 1,
      confirming: 2,
      underpaid: 2,
      payment_review: 2,
      confirmed: 3,
      notified: 3,
      swept: 4,
      delivered: 5,
    };
    return (rank[this.status()?.paymentStatus || ''] ?? 0) >= (rank[stage] ?? 0);
  }

  private isFinal(status: PublicOrderStatus): boolean {
    return FINAL_PAYMENT_STATES.has(status.paymentStatus)
      || FINAL_DELIVERY_STATES.has(status.deliveryStatus || '');
  }
}
