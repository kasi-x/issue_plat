import type { TurnstileResult } from '../lib/turnstile.js';

export async function verifyTurnstileLocal(token: string, remoteip?: string): Promise<TurnstileResult> {
  const mode = process.env.TURNSTILE_MODE || 'mock';
  if (mode === 'mock') {
    const ok = token === 'ok' || token.startsWith('test') || token.startsWith('1x');
    return { success: ok, score: ok ? 0.9 : 0.0 } as TurnstileResult;
  }
  // Fallback to real verify if desired (requires network)
  const secret = process.env.TURNSTILE_SECRET || '';
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteip) form.set('remoteip', remoteip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`turnstile verify failed: ${res.status}`);
  return (await res.json()) as TurnstileResult;
}

