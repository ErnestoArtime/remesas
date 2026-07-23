export function normalizePhoneE164(input: string): string {
  const trimmed = String(input || '').trim();
  const international = trimmed.startsWith('00')
    ? `+${trimmed.slice(2)}`
    : trimmed;
  const digits = international.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new TypeError('El teléfono debe incluir código de país y tener entre 8 y 15 dígitos');
  }
  return `+${digits}`;
}
export function toOpenWaChatId(phoneE164: string): string {
  return `${normalizePhoneE164(phoneE164).slice(1)}@c.us`;
}
