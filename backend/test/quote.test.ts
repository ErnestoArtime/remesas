import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQuote, getFeeSchedule } from '../src/services/quote';

test('la cotización usa tarifa y plazo recibidos del catálogo de entrega', () => {
  const quote = calculateQuote({
    amountDelivered: 100,
    deliverySpeed: 'standard',
    deliveryFee: 3,
    estimatedMinHours: 8,
    estimatedMaxHours: 36,
  });

  assert.equal(quote.serviceFee, 6.5);
  assert.equal(quote.deliveryFee, 3);
  assert.equal(quote.totalToPay, 109.5);
  assert.equal(quote.estimatedDelivery, 'Entre 8 y 36 horas');
});

test('el calendario público de tarifas procede de la misma fuente del cálculo', () => {
  const schedule = getFeeSchedule();
  assert.deepEqual(schedule[0], {
    minimum: 20,
    maximum: 99.99,
    percentage: 8,
    minimumFee: 5,
  });
  assert.equal(schedule.at(-1)?.maximum, 1500);
});
