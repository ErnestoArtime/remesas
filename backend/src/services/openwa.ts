export const openwaConfig = {
  get baseUrl(): string {
    return (process.env.OPENWA_BASE_URL || 'http://127.0.0.1:2785/api').replace(/\/+$/, '');
  },
  get apiKey(): string {
    return process.env.OPENWA_API_KEY || '';
  },
  get sessionId(): string {
    return process.env.OPENWA_SESSION_ID || '';
  },
  get adminChatId(): string {
    return process.env.OPENWA_ADMIN_CHAT_ID || '';
  },
  get enabled(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.sessionId);
  },
};

export interface OpenWaResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  providerMessageId?: string;
}

async function sendText(chatId: string, text: string): Promise<OpenWaResult> {
  if (!openwaConfig.enabled || !chatId) {
    return { ok: false, skipped: true, error: 'openwa-disabled-or-no-chat' };
  }

  const url = `${openwaConfig.baseUrl}/sessions/${openwaConfig.sessionId}/messages/send-text`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': openwaConfig.apiKey,
      },
      body: JSON.stringify({ chatId, text }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, error: `HTTP ${response.status}: ${body}` };
    }

    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const providerMessageId = String(body.id || body.messageId || body.message_id || '') || undefined;
    return { ok: true, providerMessageId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function notifyAdminAssignment(order: {
  reference: string;
  beneficiaryName: string;
  municipality: string;
  assignedAgentName: string;
}): Promise<OpenWaResult> {
  if (!openwaConfig.adminChatId) {
    return { ok: false, skipped: true, error: 'openwa-admin-chat-not-configured' };
  }

  const text = [
    `✅ *Entrega asignada*`,
    ``,
    `Pedido: ${order.reference}`,
    `Beneficiario: ${order.beneficiaryName}`,
    `Municipio: ${order.municipality}`,
    `Agente: ${order.assignedAgentName}`,
    ``,
    `CashFlowQba · Notificación automática`,
  ].join('\n');

  return sendText(openwaConfig.adminChatId, text);
}

export async function notifySenderDelivery(order: {
  reference: string;
  beneficiaryName: string;
  municipality: string;
  assignedAgentName: string;
  senderName: string;
  senderChatId: string;
}): Promise<OpenWaResult> {
  const chatId = order.senderChatId;
  if (!chatId) return { ok: false, skipped: true, error: 'sender-chat-not-configured' };

  const text = [
    `📦 *Tu entrega está en camino*`,
    ``,
    `Hola ${order.senderName},`,
    `el pedido ${order.reference} para ${order.beneficiaryName} en ${order.municipality} ha sido asignado a ${order.assignedAgentName} para su entrega.`,
    ``,
    `CashFlowQba · Notificación automática`,
  ].join('\n');

  return sendText(chatId, text);
}
