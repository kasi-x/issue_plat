export type TurnstileResult = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
  // Managed only
  scores?: number[];
  score?: number;
};

export async function verifyTurnstile(secret: string, token: string, remoteip?: string): Promise<TurnstileResult> {
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteip) form.set('remoteip', remoteip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`turnstile verify failed: ${res.status}`);
  return (await res.json()) as TurnstileResult;
}
