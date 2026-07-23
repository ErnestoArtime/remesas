import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { validTronDealerSignature } from '../src/routes/webhooks';

test('acepta una firma HMAC-SHA256 válida sobre el cuerpo crudo', () => {
  const secret = 'test-secret-not-used-in-production';
  const body = Buffer.from('{"event":"transaction.incoming","data":{"label":"TEST"}}');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  assert.equal(validTronDealerSignature(body, signature, secret), true);
});
test('rechaza firmas inválidas o secretos ausentes', () => {
  const body = Buffer.from('{"event":"transaction.incoming"}');
  assert.equal(validTronDealerSignature(body, '0'.repeat(64), 'different-secret'), false);
  assert.equal(validTronDealerSignature(body, '0'.repeat(64), undefined), false);
});
