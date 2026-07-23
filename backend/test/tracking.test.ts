import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../src/models/order';
import { toPublicOrderStatus } from '../src/services/public-order';
import {
  createTrackingToken,
  verifyTrackingToken,
} from '../src/services/tracking';

test('crea un token aleatorio y persiste únicamente un hash verificable', () => {
  const first = createTrackingToken();
  const second = createTrackingToken();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.hash);
  assert.equal(verifyTrackingToken(first.token, first.hash), true);
  assert.equal(verifyTrackingToken(second.token, first.hash), false);
});
test('el DTO público no contiene PII ni eventos internos', () => {
  const order: Order = {
    reference: 'RC-2026-TEST0003',
    paymentMethod: 'usdt',
    paymentStatus: 'confirming',
    deliverySpeed: 'standard',
    quote: {
      amountDelivered: 100,
      serviceFee: 6.5,
      deliveryFee: 0,
      totalToPay: 106.5,
      feePercentage: 6.5,
      estimatedDelivery: 'En 24 horas',
    },
    senderName: 'Dato privado',
    senderPhone: '+10000000000',
    beneficiaryName: 'Dato privado',
    beneficiaryPhone: '+5300000000',
    municipality: 'Dato privado',
    address: 'Dato privado',
    notes: 'Dato privado',
    confirmations: 7,
    minConfirmations: 15,
    confirmationProgress: 7 / 15,
    trackingTokenHash: 'hash-privado',
    deliveryStatus: 'unassigned',
    createdAt: '2026-07-23T00:00:00.000Z',
  };

  const publicStatus = toPublicOrderStatus(order);
  const serialized = JSON.stringify(publicStatus);

  for (const forbidden of [
    'senderName',
    'senderPhone',
    'beneficiaryName',
    'beneficiaryPhone',
    'address',
    'notes',
    'trackingTokenHash',
    'paymentEvents',
    'signature',
    'rawBody',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(publicStatus.confirmations, 7);
});
