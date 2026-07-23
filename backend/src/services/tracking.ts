import crypto from 'crypto';

export function hashTrackingToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function createTrackingToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashTrackingToken(token) };
}

export function verifyTrackingToken(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false;
  const provided = Buffer.from(hashTrackingToken(token));
  const expected = Buffer.from(expectedHash);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}
