import fs from 'fs';
import path from 'path';
import {
  Agent,
  AuditLog,
  DeliveryMethod,
  Order,
  PaymentIntent,
  PaymentOption,
  NotificationEvent,
  ProviderWebhookEvent,
  Quote,
  ServiceAnnouncement,
} from '../models/order';

const DATA_FILE = path.join(__dirname, '../../data/orders.json');
const AGENTS_FILE = path.join(__dirname, '../../data/agents.json');
const WEBHOOK_EVENTS_FILE = path.join(__dirname, '../../data/webhook-events.json');
const QUOTES_FILE = path.join(__dirname, '../../data/quotes.json');
const PAYMENT_INTENTS_FILE = path.join(__dirname, '../../data/payment-intents.json');
const PAYMENT_OPTIONS_FILE = path.join(__dirname, '../../data/payment-options.json');
const NOTIFICATION_EVENTS_FILE = path.join(__dirname, '../../data/notification-events.json');
const DELIVERY_METHODS_FILE = path.join(__dirname, '../../data/delivery-methods.json');
const SERVICE_ANNOUNCEMENTS_FILE = path.join(__dirname, '../../data/service-announcements.json');
const AUDIT_LOGS_FILE = path.join(__dirname, '../../data/audit-logs.json');

function ensureDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readAll(): Order[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(orders: Order[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

function readAgents(): Agent[] {
  ensureDir();
  if (!fs.existsSync(AGENTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAgents(agents: Agent[]): void {
  ensureDir();
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
}

function readWebhookEvents(): ProviderWebhookEvent[] {
  ensureDir();
  if (!fs.existsSync(WEBHOOK_EVENTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(WEBHOOK_EVENTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeWebhookEvents(events: ProviderWebhookEvent[]): void {
  ensureDir();
  fs.writeFileSync(WEBHOOK_EVENTS_FILE, JSON.stringify(events, null, 2));
}

function readJsonArray<T>(file: string): T[] {
  ensureDir();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJsonArray<T>(file: string, values: T[]): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(values, null, 2));
}

export const store = {
  findAll(): Order[] {
    return readAll();
  },

  findByReference(ref: string): Order | undefined {
    return readAll().find((o) => o.reference === ref);
  },

  save(order: Order): void {
    const orders = readAll();
    const idx = orders.findIndex((o) => o.reference === order.reference);
    if (idx >= 0) orders[idx] = order;
    else orders.push(order);
    writeAll(orders);
  },

  findAgents(): Agent[] {
    return readAgents();
  },

  findAgentById(id: string): Agent | undefined {
    return readAgents().find((agent) => agent.id === id);
  },

  saveAgent(agent: Agent): void {
    const agents = readAgents();
    const index = agents.findIndex((item) => item.id === agent.id);
    if (index >= 0) agents[index] = agent;
    else agents.push(agent);
    writeAgents(agents);
  },

  hasWebhookEvent(deduplicationKey: string): boolean {
    return readWebhookEvents().some((event) => event.deduplicationKey === deduplicationKey);
  },

  saveWebhookEvent(event: ProviderWebhookEvent): void {
    const events = readWebhookEvents();
    if (events.some((item) => item.deduplicationKey === event.deduplicationKey)) return;
    events.push(event);
    writeWebhookEvents(events);
  },

  findWebhookEvents(): ProviderWebhookEvent[] {
    return readWebhookEvents();
  },

  findQuoteById(id: string): Quote | undefined {
    return readJsonArray<Quote>(QUOTES_FILE).find((quote) => quote.id === id);
  },

  saveQuote(quote: Quote): void {
    const quotes = readJsonArray<Quote>(QUOTES_FILE);
    const index = quotes.findIndex((item) => item.id === quote.id);
    if (index >= 0) quotes[index] = quote;
    else quotes.push(quote);
    writeJsonArray(QUOTES_FILE, quotes);
  },

  findPaymentIntentById(id: string): PaymentIntent | undefined {
    return readJsonArray<PaymentIntent>(PAYMENT_INTENTS_FILE).find((intent) => intent.id === id);
  },

  findPaymentIntentByOrderReference(reference: string): PaymentIntent | undefined {
    return readJsonArray<PaymentIntent>(PAYMENT_INTENTS_FILE)
      .find((intent) => intent.orderReference === reference);
  },

  findPaymentIntents(): PaymentIntent[] {
    return readJsonArray<PaymentIntent>(PAYMENT_INTENTS_FILE);
  },

  savePaymentIntent(intent: PaymentIntent): void {
    const intents = readJsonArray<PaymentIntent>(PAYMENT_INTENTS_FILE);
    const index = intents.findIndex((item) => item.id === intent.id);
    if (index >= 0) intents[index] = intent;
    else intents.push(intent);
    writeJsonArray(PAYMENT_INTENTS_FILE, intents);
  },

  findPaymentOptions(): PaymentOption[] {
    const configured = readJsonArray<PaymentOption>(PAYMENT_OPTIONS_FILE);
    return configured.length ? configured : DEFAULT_PAYMENT_OPTIONS;
  },

  findPaymentOptionById(id: string): PaymentOption | undefined {
    return this.findPaymentOptions().find((option) => option.id === id);
  },

  savePaymentOption(option: PaymentOption): void {
    const options = this.findPaymentOptions();
    const index = options.findIndex((item) => item.id === option.id);
    if (index >= 0) options[index] = option;
    else options.push(option);
    writeJsonArray(PAYMENT_OPTIONS_FILE, options);
  },

  findDeliveryMethods(): DeliveryMethod[] {
    const configured = readJsonArray<DeliveryMethod>(DELIVERY_METHODS_FILE);
    return configured.length ? configured : DEFAULT_DELIVERY_METHODS;
  },

  findDeliveryMethodById(id: string): DeliveryMethod | undefined {
    return this.findDeliveryMethods().find((method) => method.id === id || method.code === id);
  },

  saveDeliveryMethod(method: DeliveryMethod): void {
    const methods = this.findDeliveryMethods();
    const index = methods.findIndex((item) => item.id === method.id);
    if (index >= 0) methods[index] = method;
    else methods.push(method);
    writeJsonArray(DELIVERY_METHODS_FILE, methods);
  },

  findServiceAnnouncements(): ServiceAnnouncement[] {
    return readJsonArray<ServiceAnnouncement>(SERVICE_ANNOUNCEMENTS_FILE);
  },

  findServiceAnnouncementById(id: string): ServiceAnnouncement | undefined {
    return this.findServiceAnnouncements().find((announcement) => announcement.id === id);
  },

  saveServiceAnnouncement(announcement: ServiceAnnouncement): void {
    const announcements = this.findServiceAnnouncements();
    const index = announcements.findIndex((item) => item.id === announcement.id);
    if (index >= 0) announcements[index] = announcement;
    else announcements.push(announcement);
    writeJsonArray(SERVICE_ANNOUNCEMENTS_FILE, announcements);
  },

  findNotificationEvents(orderReference?: string): NotificationEvent[] {
    const events = readJsonArray<NotificationEvent>(NOTIFICATION_EVENTS_FILE);
    return orderReference
      ? events.filter((event) => event.orderReference === orderReference)
      : events;
  },

  saveNotificationEvent(event: NotificationEvent): void {
    const events = readJsonArray<NotificationEvent>(NOTIFICATION_EVENTS_FILE);
    const index = events.findIndex((item) => item.id === event.id);
    if (index >= 0) events[index] = event;
    else events.push(event);
    writeJsonArray(NOTIFICATION_EVENTS_FILE, events);
  },

  findAuditLogs(): AuditLog[] {
    return readJsonArray<AuditLog>(AUDIT_LOGS_FILE);
  },

  saveAuditLog(log: AuditLog): void {
    const logs = readJsonArray<AuditLog>(AUDIT_LOGS_FILE);
    logs.push(log);
    writeJsonArray(AUDIT_LOGS_FILE, logs);
  },
};

const DEFAULT_PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'usdt-bsc',
    provider: 'trondealer',
    asset: 'USDT',
    network: 'bsc',
    enabled: true,
    stablecoin: true,
    addressType: 'evm',
    minAmountUsd: 20,
    maxAmountUsd: 1500,
    minConfirmations: 15,
    estimatedConfirmationTime: 'Entre 1 y 5 minutos',
    warning: 'Envía únicamente USDT por BSC / BEP-20.',
  },
  {
    id: 'eur-manual',
    provider: 'manual',
    asset: 'EUR',
    network: 'manual',
    enabled: true,
    stablecoin: false,
    addressType: 'other',
    minAmountUsd: 20,
    maxAmountUsd: 1500,
    minConfirmations: 0,
    estimatedConfirmationTime: 'Confirmación manual',
    warning: 'El pago se coordina por WhatsApp mediante IBAN o Bizum.',
  },
];

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = [
  {
    id: 'usd-cash-havana',
    code: 'usd_cash',
    name: 'USD en efectivo',
    currency: 'USD',
    type: 'cash',
    zone: 'havana',
    active: true,
    minAmount: 20,
    maxAmount: 1500,
    fee: 0,
    estimatedMinHours: 6,
    estimatedMaxHours: 24,
    description: 'Entrega coordinada en La Habana.',
  },
];
