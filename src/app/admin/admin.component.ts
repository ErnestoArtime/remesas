import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

interface Agent {
  id: string;
  name: string;
  phone: string;
  zone: string;
  active: boolean;
}

interface AdminOrder {
  reference: string;
  paymentMethod: 'usdt' | 'euro';
  paymentStatus: string;
  deliveryStatus?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  municipality: string;
  address: string;
  quote: { amountDelivered: number; totalToPay: number };
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, UpperCasePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private token = sessionStorage.getItem('remesa-admin-token') || '';

  protected readonly authenticated = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly orders = signal<AdminOrder[]>([]);
  protected readonly agents = signal<Agent[]>([]);
  protected readonly search = signal('');
  protected readonly statusFilter = signal('all');
  protected readonly selectedAgents: Record<string, string> = {};

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    token: ['', Validators.required],
  });

  protected readonly agentForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    zone: ['La Habana', Validators.required],
  });

  protected readonly filteredOrders = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filter = this.statusFilter();
    return this.orders().filter((order) => {
      const matchesQuery = !query || [
        order.reference,
        order.beneficiaryName,
        order.beneficiaryPhone,
        order.municipality,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesFilter = filter === 'all'
        || (filter === 'ready' && this.canAssign(order))
        || order.deliveryStatus === filter
        || order.paymentStatus === filter;
      return matchesQuery && matchesFilter;
    });
  });

  protected readonly metrics = computed(() => ({
    total: this.orders().length,
    ready: this.orders().filter((order) => this.canAssign(order) && !order.assignedAgentId).length,
    active: this.orders().filter((order) => ['assigned', 'out_for_delivery'].includes(order.deliveryStatus || '')).length,
    delivered: this.orders().filter((order) => order.deliveryStatus === 'delivered').length,
  }));

  constructor() {
    if (this.token) this.loadData();
  }

  protected login(): void {
    if (this.loginForm.invalid) return;
    this.token = this.loginForm.controls.token.value.trim();
    this.loadData(true);
  }

  protected logout(): void {
    sessionStorage.removeItem('remesa-admin-token');
    this.token = '';
    this.authenticated.set(false);
    this.orders.set([]);
    this.agents.set([]);
    this.loginForm.reset();
  }

  protected refresh(): void {
    this.loadData();
  }

  protected createAgent(): void {
    this.agentForm.markAllAsTouched();
    if (this.agentForm.invalid) return;
    this.clearMessages();
    this.http.post<Agent>('/api/admin/agents', this.agentForm.getRawValue(), { headers: this.headers() })
      .subscribe({
        next: (agent) => {
          this.agents.update((agents) => [...agents, agent].sort((a, b) => a.name.localeCompare(b.name)));
          this.agentForm.reset({ zone: 'La Habana', name: '', phone: '' });
          this.notice.set(`Agente ${agent.name} registrado.`);
        },
        error: (response) => this.error.set(response.error?.error || 'No se pudo registrar el agente.'),
      });
  }

  protected setSelectedAgent(reference: string, agentId: string): void {
    this.selectedAgents[reference] = agentId;
  }

  protected assign(order: AdminOrder): void {
    const agentId = this.selectedAgents[order.reference] || order.assignedAgentId;
    if (!agentId) {
      this.error.set('Selecciona un agente antes de asignar.');
      return;
    }
    this.patchOrder(order.reference, 'assign', { agentId }, 'Entrega asignada.');
  }

  protected confirmEuroPayment(order: AdminOrder): void {
    this.patchOrder(order.reference, 'payment-status', {}, 'Pago EUR confirmado. Ya puedes asignar la entrega.');
  }

  protected updateDelivery(order: AdminOrder, status: string): void {
    this.patchOrder(order.reference, 'delivery-status', { status }, 'Estado de entrega actualizado.');
  }

  protected canAssign(order: AdminOrder): boolean {
    return ['confirmed', 'notified', 'swept', 'ready_for_delivery'].includes(order.paymentStatus);
  }

  protected paymentLabel(status: string): string {
    const labels: Record<string, string> = {
      pending_wallet: 'Preparando wallet',
      awaiting_payment: 'Esperando pago',
      detected: 'Pago detectado',
      confirmed: 'Pago confirmado',
      notified: 'Confirmado',
      swept: 'Fondos recibidos',
      contact_whatsapp: 'Coordinar EUR',
      delivered: 'Completado',
    };
    return labels[status] || status;
  }

  protected deliveryLabel(status?: string): string {
    const labels: Record<string, string> = {
      unassigned: 'Sin asignar',
      assigned: 'Asignada',
      out_for_delivery: 'En camino',
      delivered: 'Entregada',
      failed: 'Incidencia',
      cancelled: 'Cancelada',
    };
    return labels[status || 'unassigned'];
  }

  private loadData(persistToken = false): void {
    this.loading.set(true);
    this.clearMessages();
    forkJoin({
      orders: this.http.get<AdminOrder[]>('/api/admin/orders', { headers: this.headers() }),
      agents: this.http.get<Agent[]>('/api/admin/agents', { headers: this.headers() }),
    }).subscribe({
      next: ({ orders, agents }) => {
        this.orders.set(orders);
        this.agents.set(agents);
        this.authenticated.set(true);
        this.loading.set(false);
        if (persistToken) sessionStorage.setItem('remesa-admin-token', this.token);
      },
      error: (response) => {
        this.loading.set(false);
        this.authenticated.set(false);
        this.error.set(response.status === 401 ? 'Clave administrativa incorrecta.' : 'No se pudo conectar con el servidor.');
      },
    });
  }

  private patchOrder(reference: string, action: string, body: object, successMessage: string): void {
    this.clearMessages();
    this.http.patch<AdminOrder>(`/api/admin/orders/${reference}/${action}`, body, { headers: this.headers() })
      .subscribe({
        next: (updated) => {
          this.orders.update((orders) => orders.map((order) => order.reference === reference ? updated : order));
          this.notice.set(successMessage);
        },
        error: (response) => this.error.set(response.error?.error || 'No se pudo actualizar la orden.'),
      });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  private clearMessages(): void {
    this.error.set('');
    this.notice.set('');
  }
}
