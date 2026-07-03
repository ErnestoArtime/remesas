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

async function sendText(chatId: string, text: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
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

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function notifyAdminAssignment(order: {
  reference: string;
  beneficiaryName: string;
  municipality: string;
  assignedAgentName: string;
}): Promise<void> {
  if (!openwaConfig.adminChatId) return;

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

  await sendText(openwaConfig.adminChatId, text);
}

export async function notifySenderDelivery(order: {
  reference: string;
  beneficiaryName: string;
  municipality: string;
  assignedAgentName: string;
  senderName: string;
  senderChatId: string;
}): Promise<void> {
  const chatId = order.senderChatId;
  if (!chatId) return;

  const text = [
    `📦 *Tu entrega está en camino*`,
    ``,
    `Hola ${order.senderName},`,
    `el pedido ${order.reference} para ${order.beneficiaryName} en ${order.municipality} ha sido asignado a ${order.assignedAgentName} para su entrega.`,
    ``,
    `CashFlowQba · Notificación automática`,
  ].join('\n');

  await sendText(chatId, text);
}
