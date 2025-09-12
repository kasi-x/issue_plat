// HMAC-based IP hash: HMAC_SHA256(salt, ip + YYYY-MM-DD)
// Returns hex string.

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacIpHash(salt: string, ip: string, dateISO: string, cryptoImpl: Crypto = crypto): Promise<string> {
  const data = new TextEncoder().encode(ip + dateISO);
  const keyData = new TextEncoder().encode(salt);
  const key = await cryptoImpl.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await cryptoImpl.subtle.sign('HMAC', key, data);
  return toHex(sig);
}

export function isoDateUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
