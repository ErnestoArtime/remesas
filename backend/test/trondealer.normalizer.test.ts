import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Order } from '../src/models/order';
import { normalizeTronDealerEvent } from '../src/providers/trondealer/trondealer.normalizer';
import { applyTronDealerEvent } from '../src/providers/trondealer/trondealer.webhook';

const fixtures = path.join(__dirname, 'fixtures/trondealer');

function fixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));
}

function order(): Order {
  return {
    reference: 'RC-2026-TEST0001',
    paymentMethod: 'usdt',
    paymentStatus: 'awaiting_payment',
    deliverySpeed: 'standard',
    quote: {
      amountDelivered: 100,
      serviceFee: 6.5,
      deliveryFee: 0,
      totalToPay: 106.5,
      feePercentage: 6.5,
      estimatedDelivery: 'En 24 horas',
    },
    senderName: 'Remitente de prueba',
    senderPhone: '+10000000000',
    beneficiaryName: 'Beneficiario de prueba',
    beneficiaryPhone: '+5300000000',
    municipality: 'Plaza',
    address: 'Dirección anonimizada',
    notes: '',
    deliveryStatus: 'unassigned',
    createdAt: '2026-07-23T00:00:00.000Z',
  };
}

test('normaliza un evento plano legado', () => {
  const event = normalizeTronDealerEvent(fixture('transaction.incoming.flat.json'));
  assert.equal(event.eventType, 'transaction.incoming');
  assert.equal(event.outputIndex, '0');
  assert.equal(event.amountUsd, 106.5);
  assert.equal(event.minConfirmations, 15);
});

test('normaliza confirmation_update envuelto y diferencia cada progreso', () => {
  const payload = fixture('transaction.confirmation_update.wrapped.json');
  const seven = normalizeTronDealerEvent(payload);
  const eight = normalizeTronDealerEvent({
    ...(payload as Record<string, unknown>),
    data: {
      ...((payload as { data: Record<string, unknown> }).data),
      confirmations: 8,
    },
  });

  assert.equal(seven.eventType, 'transaction.confirmation_update');
  assert.equal(seven.confirmations, 7);
  assert.notEqual(seven.deduplicationKey, eight.deduplicationKey);
});

test('normaliza monto nativo, precio y vout de Bitcoin', () => {
  const event = normalizeTronDealerEvent(fixture('transaction.confirmed.native.wrapped.json'));
  assert.equal(event.eventType, 'transaction.confirmed');
  assert.equal(event.asset, 'BTC');
  assert.equal(event.amountUsd, 106.72);
  assert.equal(event.amountNative, '0.00141106');
  assert.equal(event.priceUsd, 75630);
  assert.equal(event.outputIndex, '1');
});

test('las confirmaciones y los estados nunca retroceden', () => {
  const current = order();
  const incoming = normalizeTronDealerEvent(fixture('transaction.incoming.flat.json'));
  const updateSeven = normalizeTronDealerEvent(fixture('transaction.confirmation_update.wrapped.json'));
  const updateFive = normalizeTronDealerEvent({
    event: 'transaction.confirmation_update',
    data: {
      ...(updateSeven.rawPayload as { data: Record<string, unknown> }).data,
      confirmations: 5,
    },
  });
  const confirmed = normalizeTronDealerEvent({
    event: 'transaction.confirmed',
    data: {
      ...(updateSeven.rawPayload as { data: Record<string, unknown> }).data,
      confirmations: 15,
    },
  });

  applyTronDealerEvent(current, incoming, '2026-07-23T00:01:00.000Z');
  assert.equal(current.paymentStatus, 'detected');

  applyTronDealerEvent(current, updateSeven, '2026-07-23T00:02:00.000Z');
  assert.equal(current.paymentStatus, 'confirming');
  assert.equal(current.confirmations, 7);
  assert.equal(current.confirmationProgress, 7 / 15);

  applyTronDealerEvent(current, updateFive, '2026-07-23T00:03:00.000Z');
  assert.equal(current.confirmations, 7);

  applyTronDealerEvent(current, confirmed, '2026-07-23T00:04:00.000Z');
  assert.equal(current.paymentStatus, 'confirmed');

  applyTronDealerEvent(current, incoming, '2026-07-23T00:05:00.000Z');
  applyTronDealerEvent(current, updateFive, '2026-07-23T00:06:00.000Z');
  assert.equal(current.paymentStatus, 'confirmed');
  assert.equal(current.confirmations, 15);
});

test('confirmation_update jamás confirma ni libera una entrega', () => {
  const current = order();
  const update = normalizeTronDealerEvent(fixture('transaction.confirmation_update.wrapped.json'));
  applyTronDealerEvent(current, update);
  assert.equal(current.paymentStatus, 'confirming');
  assert.equal(current.deliveryStatus, 'unassigned');
});

test('un pago confirmado insuficiente queda bloqueado', () => {
  const current = order();
  const confirmed = normalizeTronDealerEvent({
    event: 'transaction.confirmed',
    data: {
      label: current.reference,
      tx_hash: '0xunderpaid',
      log_index: 0,
      asset: 'USDT',
      network: 'bsc',
      amount: '100',
    },
  });
  applyTronDealerEvent(current, confirmed);
  assert.equal(current.paymentStatus, 'underpaid');
});

test('un pago dentro de tolerancia se confirma y conserva la diferencia', () => {
  const current = order();
  const confirmed = normalizeTronDealerEvent({
    event: 'transaction.confirmed',
    data: {
      label: current.reference,
      tx_hash: '0xtolerance',
      log_index: 0,
      asset: 'USDT',
      network: 'bsc',
      amount: '106.47',
    },
  });
  applyTronDealerEvent(current, confirmed);
  assert.equal(current.paymentStatus, 'confirmed');
  assert.equal(current.paymentVarianceUsd, -0.03);
  assert.equal(current.paymentExcessUsd, 0);
});

test('un excedente nativo se registra sin aumentar el monto de entrega', () => {
  const current = order();
  const amountDelivered = current.quote.amountDelivered;
  const confirmed = normalizeTronDealerEvent(fixture('transaction.confirmed.native.wrapped.json'));
  applyTronDealerEvent(current, confirmed);
  assert.equal(current.paymentStatus, 'confirmed');
  assert.equal(current.paidAmountNative, '0.00141106');
  assert.equal(current.paidPriceUsd, 75630);
  assert.equal(current.paymentExcessUsd, 0.22);
  assert.equal(current.quote.amountDelivered, amountDelivered);
});

test('un evento desconocido no cambia el estado comercial', () => {
  const current = order();
  const unknown = normalizeTronDealerEvent({
    event: 'transaction.future_event',
    data: { label: current.reference, tx_hash: '0xfuture', log_index: 0 },
  });
  applyTronDealerEvent(current, unknown);
  assert.equal(current.paymentStatus, 'awaiting_payment');
});
