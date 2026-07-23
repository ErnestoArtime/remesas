import crypto from 'crypto';
import type {
  NormalizedPaymentEvent,
  TronDealerEventType,
} from './trondealer.types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function first(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

function numberValue(value: unknown): number | undefined {
  if (value === '' || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerValue(value: unknown): number | undefined {
  const parsed = numberValue(value);
  if (parsed === undefined || parsed < 0) return undefined;
  return Math.floor(parsed);
}

function normalizeEventType(
  eventName: string,
  providerStatus: string,
): TronDealerEventType {
  const normalizedName = eventName.toLowerCase();
  if (
    normalizedName === 'transaction.incoming'
    || normalizedName === 'transaction.confirmation_update'
    || normalizedName === 'transaction.confirmed'
    || normalizedName === 'transaction.swept'
  ) {
    return normalizedName;
  }

  switch (providerStatus.toLowerCase()) {
    case 'detected':
    case 'incoming':
      return 'transaction.incoming';
    case 'confirmation_update':
    case 'confirming':
    case 'updated':
      return 'transaction.confirmation_update';
    case 'confirmed':
      return 'transaction.confirmed';
    case 'notified':
      return 'legacy.notified';
    case 'swept':
      return 'transaction.swept';
    default:
      return 'unknown';
  }
}

function fingerprint(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createDeduplicationKey(
  eventType: TronDealerEventType,
  txHash: string,
  outputIndex: string,
  confirmations: number | undefined,
  payload: unknown,
): string {
  const identity = txHash
    ? `${txHash}:${outputIndex || '-'}`
    : `payload:${fingerprint(payload)}`;

  if (eventType === 'transaction.confirmation_update') {
    return `trondealer:${identity}:${eventType}:${confirmations ?? `payload-${fingerprint(payload)}`}`;
  }

  if (eventType === 'unknown') {
    return `trondealer:${identity}:${eventType}:${fingerprint(payload)}`;
  }

  return `trondealer:${identity}:${eventType}`;
}

export function normalizeTronDealerEvent(payload: unknown): NormalizedPaymentEvent {
  if (!isRecord(payload)) {
    throw new TypeError('El payload de TronDealer debe ser un objeto JSON');
  }

  const wrappedData = isRecord(payload.data) ? payload.data : undefined;
  const data = wrappedData ?? payload;
  const eventName = textValue(payload.event);
  const providerStatus = textValue(first(data, ['status', 'provider_status', 'providerStatus']));
  const eventType = normalizeEventType(eventName, providerStatus);
  const txHash = textValue(first(data, ['tx_hash', 'txHash', 'transaction_hash', 'transactionHash']));
  const outputIndex = textValue(first(data, [
    'output_index',
    'outputIndex',
    'log_index',
    'logIndex',
    'vout_index',
    'voutIndex',
  ]));
  const confirmations = integerValue(first(data, ['confirmations', 'confirmation_count', 'confirmationCount']));

  return {
    provider: 'trondealer',
    eventType,
    providerStatus: providerStatus || undefined,
    label: textValue(first(data, ['label', 'reference', 'order_reference', 'orderReference'])),
    txHash,
    outputIndex,
    asset: textValue(first(data, ['asset', 'currency', 'token'])) || 'USDT',
    network: textValue(first(data, ['network', 'chain', 'blockchain'])),
    amountUsd: numberValue(first(data, ['amount', 'amount_usd', 'amountUsd'])),
    amountNative: textValue(first(data, ['amount_native', 'amountNative'])) || undefined,
    priceUsd: numberValue(first(data, ['price_usd', 'priceUsd', 'price_usd_at_detect'])),
    confirmations,
    minConfirmations: integerValue(first(data, ['min_confirmations', 'minConfirmations'])),
    fromAddress: textValue(first(data, ['from_address', 'fromAddress', 'from'])) || undefined,
    toAddress: textValue(first(data, ['to_address', 'toAddress', 'to'])) || undefined,
    occurredAt: textValue(first(data, ['occurred_at', 'occurredAt', 'created_at', 'createdAt', 'timestamp'])) || undefined,
    deduplicationKey: createDeduplicationKey(
      eventType,
      txHash,
      outputIndex,
      confirmations,
      payload,
    ),
    rawPayload: payload,
  };
}
