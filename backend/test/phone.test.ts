import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhoneE164, toOpenWaChatId } from '../src/services/phone';

test('normaliza teléfonos y construye el JID sin exponerlo al usuario', () => {
  assert.equal(normalizePhoneE164('+53 5 123 4567'), '+5351234567');
  assert.equal(normalizePhoneE164('00 44 7424 267675'), '+447424267675');
  assert.equal(toOpenWaChatId('+53 5 123 4567'), '5351234567@c.us');
});
test('rechaza números fuera del rango E.164', () => {
  assert.throws(() => normalizePhoneE164('123'));
  assert.throws(() => normalizePhoneE164('1'.repeat(16)));
});
