import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import * as QRCode from 'qrcode';
import { catchError, debounceTime, EMPTY, startWith, switchMap } from 'rxjs';
import {
  DeliveryMethod,
  FeeTier,
  PaymentOption,
  RemittanceOrder,
  RemittanceQuote,
  ServiceAnnouncement,
} from '../../core/models/remittance.model';
import { QuoteService } from '../../core/services/quote.service';

const EMPTY_QUOTE: RemittanceQuote = {
  quoteId: '',
  amountDelivered: 0,
  serviceFee: 0,
  deliveryFee: 0,
  totalToPay: 0,
  feePercentage: 0,
  estimatedDelivery: 'Calculando…',
  expiresAt: '',
  paymentOption: {
    id: '',
    provider: 'trondealer',
    asset: 'USDT',
    network: 'bsc',
    enabled: false,
    stablecoin: true,
    addressType: 'evm',
    minAmountUsd: 20,
    maxAmountUsd: 1500,
    minConfirmations: 15,
    estimatedConfirmationTime: '',
    warning: '',
  },
};

@Component({
  selector: 'app-home',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly quoteService = inject(QuoteService);
  private readonly destroyRef = inject(DestroyRef);
  private lastRefreshedExpiredQuoteId = '';

  protected readonly currentStep = signal<1 | 2 | 3>(1);
  protected readonly order = signal<RemittanceOrder | null>(null);
  protected readonly darkMode = signal(this.initialTheme() === 'dark');
  protected readonly paymentOptions = signal<PaymentOption[]>([]);
  protected readonly deliveryMethods = signal<DeliveryMethod[]>([]);
  protected readonly serviceAnnouncements = signal<ServiceAnnouncement[]>([]);
  protected readonly feeSchedule = signal<FeeTier[]>([]);
  protected readonly quoteLoading = signal(true);
  protected readonly quoteError = signal('');
  protected readonly remainingQuoteSeconds = signal(0);
  protected readonly paymentQrDataUrl = signal('');
  protected readonly copyFeedback = signal('');

  protected readonly quoteForm = this.formBuilder.nonNullable.group({
    amount: [100, [Validators.required, Validators.min(20), Validators.max(1500)]],
    zone: ['havana' as const, Validators.required],
    speed: ['standard' as const, Validators.required],
    paymentOptionId: ['usdt-bsc', Validators.required],
    deliveryMethod: ['usd_cash', Validators.required],
  });

  protected readonly detailsForm = this.formBuilder.nonNullable.group({
    senderName: ['', [Validators.required, Validators.minLength(3)]],
    senderPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{8,20}$/)]],
    whatsappConsent: [false],
    beneficiaryName: ['', [Validators.required, Validators.minLength(3)]],
    beneficiaryPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{8,20}$/)]],
    municipality: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(8)]],
    notes: [''],
    isSurprise: [false],
    consent: [false, Validators.requiredTrue],
  });

  protected readonly quote = signal<RemittanceQuote>(EMPTY_QUOTE);

  protected readonly progress = computed(() => `${this.currentStep() * 33.333}%`);
  protected readonly quoteCountdown = computed(() => {
    const seconds = this.remainingQuoteSeconds();
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  });

  constructor() {
    this.applyTheme(this.darkMode() ? 'dark' : 'light');

    this.quoteService.getPaymentOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.paymentOptions.set(options);
          const selected = this.quoteForm.controls.paymentOptionId.value;
          if (!options.some((option) => option.id === selected) && options[0]) {
            this.quoteForm.controls.paymentOptionId.setValue(options[0].id);
          }
        },
        error: () => this.quoteError.set('No se pudieron cargar los métodos de pago.'),
      });

    this.quoteService.getDeliveryMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (methods) => {
          this.deliveryMethods.set(methods);
          const selected = this.quoteForm.controls.deliveryMethod.value;
          if (!methods.some((method) => method.code === selected) && methods[0]) {
            this.quoteForm.controls.deliveryMethod.setValue(methods[0].code);
          }
        },
        error: () => this.quoteError.set('No se pudieron cargar los métodos de entrega.'),
      });

    this.quoteService.getServiceAnnouncements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (announcements) => this.serviceAnnouncements.set(announcements),
        error: () => this.serviceAnnouncements.set([]),
      });

    this.quoteService.getFeeSchedule()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tiers) => this.feeSchedule.set(tiers),
        error: () => this.feeSchedule.set([]),
      });

    this.quoteForm.valueChanges
      .pipe(
        startWith(this.quoteForm.getRawValue()),
        debounceTime(250),
        switchMap(() => {
          this.quoteLoading.set(true);
          this.quoteError.set('');
          return this.quoteService.calculate(this.quoteForm.getRawValue()).pipe(
            catchError(() => {
              this.quoteLoading.set(false);
              this.quoteError.set('No se pudo generar la cotización. Intenta nuevamente.');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((quote) => {
        this.quote.set(quote);
        this.lastRefreshedExpiredQuoteId = '';
        this.quoteLoading.set(false);
        this.updateQuoteCountdown();
      });

    const countdownTimer = window.setInterval(() => this.updateQuoteCountdown(), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(countdownTimer));
  }

  protected continueToDetails(): void {
    this.quoteForm.markAllAsTouched();
    if (this.quoteForm.invalid || this.quoteLoading() || !this.quote().quoteId) return;
    this.currentStep.set(2);
    this.scrollToTool();
  }

  protected returnToQuote(): void {
    this.currentStep.set(1);
    this.scrollToTool();
  }

  protected createOrder(): void {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;

    const details = this.detailsForm.getRawValue();
    const quote = this.quote();

    this.http.post('/api/orders', {
      quoteId: quote.quoteId,
      senderName: details.senderName,
      senderPhone: details.senderPhone,
      whatsappConsent: details.whatsappConsent,
      beneficiaryName: details.beneficiaryName,
      beneficiaryPhone: details.beneficiaryPhone,
      municipality: details.municipality,
      address: details.address,
      notes: details.notes,
      isSurprise: details.isSurprise,
    }).subscribe({
      next: (order: any) => {
        this.order.set(order);
        this.createPaymentQr(order.tronWalletAddress);
        this.currentStep.set(3);
        this.scrollToTool();
      },
      error: () => {
        alert('Error al registrar la remesa. Intenta de nuevo.');
      },
    });
  }

  protected startAnother(): void {
    this.detailsForm.reset();
    this.order.set(null);
    this.paymentQrDataUrl.set('');
    this.copyFeedback.set('');
    this.currentStep.set(1);
    this.quoteForm.updateValueAndValidity({ emitEvent: true });
    this.scrollToTool();
  }

  protected toggleTheme(): void {
    const theme = this.darkMode() ? 'light' : 'dark';
    this.darkMode.set(theme === 'dark');
    this.applyTheme(theme);
    localStorage.setItem('cashflowqba-theme', theme);
  }

  protected fieldInvalid(form: 'quote' | 'details', field: string): boolean {
    const control = form === 'quote' ? this.quoteForm.get(field) : this.detailsForm.get(field);
    return Boolean(control?.invalid && control.touched);
  }

  protected copyPaymentValue(value: string, label: string): void {
    navigator.clipboard.writeText(value).then(() => {
      this.copyFeedback.set(`${label} copiado`);
      window.setTimeout(() => this.copyFeedback.set(''), 2200);
    }).catch(() => {
      this.copyFeedback.set(`No se pudo copiar ${label.toLowerCase()}`);
    });
  }

  protected paymentNetworkLabel(order: RemittanceOrder): string {
    return (order.paidNetwork || this.quote().paymentOption.network).toUpperCase();
  }

  protected paymentAssetLabel(order: RemittanceOrder): string {
    return order.paidAsset || this.quote().paymentOption.asset;
  }

  private scrollToTool(): void {
    window.setTimeout(() => document.querySelector('#enviar')?.scrollIntoView({ behavior: 'smooth' }));
  }

  private initialTheme(): 'light' | 'dark' {
    const savedTheme = localStorage.getItem('cashflowqba-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.dataset['theme'] = theme;
  }

  private updateQuoteCountdown(): void {
    const expiresAt = this.quote().expiresAt;
    if (!expiresAt) {
      this.remainingQuoteSeconds.set(0);
      return;
    }
    const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
    this.remainingQuoteSeconds.set(seconds);
    if (
      seconds === 0
      && this.currentStep() === 1
      && this.lastRefreshedExpiredQuoteId !== this.quote().quoteId
    ) {
      this.lastRefreshedExpiredQuoteId = this.quote().quoteId;
      this.quoteForm.updateValueAndValidity({ emitEvent: true });
    }
  }

  private createPaymentQr(address?: string): void {
    this.paymentQrDataUrl.set('');
    if (!address) return;
    QRCode.toDataURL(address, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#092b4c', light: '#ffffff' },
    }).then((dataUrl) => this.paymentQrDataUrl.set(dataUrl))
      .catch(() => this.paymentQrDataUrl.set(''));
  }
}
