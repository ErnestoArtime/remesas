import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentMethod, RemittanceOrder } from './core/models/remittance.model';
import { QuoteService } from './core/services/quote.service';
import { AdminComponent } from './admin/admin.component';

@Component({
  selector: 'app-root',
  imports: [AdminComponent, CurrencyPipe, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly quoteService = inject(QuoteService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentStep = signal<1 | 2 | 3>(1);
  protected readonly order = signal<RemittanceOrder | null>(null);
  protected readonly darkMode = signal(this.initialTheme() === 'dark');
  protected readonly isAdminPage = window.location.pathname.startsWith('/admin');

  protected readonly quoteForm = this.formBuilder.nonNullable.group({
    amount: [100, [Validators.required, Validators.min(20), Validators.max(1500)]],
    zone: ['havana' as const, Validators.required],
    speed: ['standard' as const, Validators.required],
    paymentMethod: ['usdt' as PaymentMethod, Validators.required],
  });

  protected readonly detailsForm = this.formBuilder.nonNullable.group({
    senderName: ['', [Validators.required, Validators.minLength(3)]],
    senderPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{8,20}$/)]],
    beneficiaryName: ['', [Validators.required, Validators.minLength(3)]],
    beneficiaryPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{8,20}$/)]],
    municipality: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(8)]],
    notes: [''],
    consent: [false, Validators.requiredTrue],
  });

  protected readonly quote = signal(
    this.quoteService.calculate(this.quoteForm.getRawValue()),
  );

  protected readonly progress = computed(() => `${this.currentStep() * 33.333}%`);

  constructor() {
    this.applyTheme(this.darkMode() ? 'dark' : 'light');

    this.quoteForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.quote.set(this.quoteService.calculate(this.quoteForm.getRawValue())));
  }

  protected continueToDetails(): void {
    this.quoteForm.markAllAsTouched();
    if (this.quoteForm.invalid) return;
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
    const { paymentMethod, speed } = this.quoteForm.getRawValue();

    this.http.post('/api/orders', {
      paymentMethod,
      deliverySpeed: speed,
      amountDelivered: quote.amountDelivered,
      totalToPay: quote.totalToPay,
      serviceFee: quote.serviceFee,
      deliveryFee: quote.deliveryFee,
      feePercentage: quote.feePercentage,
      senderName: details.senderName,
      senderPhone: details.senderPhone,
      beneficiaryName: details.beneficiaryName,
      beneficiaryPhone: details.beneficiaryPhone,
      municipality: details.municipality,
      address: details.address,
      notes: details.notes,
    }).subscribe({
      next: (order: any) => {
        this.order.set(order);
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
    this.currentStep.set(1);
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
}
