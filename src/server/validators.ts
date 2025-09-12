export function validateAnnotationBody(body: any, isReply: boolean) {
  if (!body || !body.post_slug || !body.body_html || !body.selectors || !body.quote || !body.turnstile_token || !body.idempotency_key) {
    return { status: 400, error: 'invalid_input' } as const;
  }
  if (body.display_name && body.display_name.length > 32) return { status: 400, error: 'too_long' } as const;
  if (isReply && !body.parent_id) return { status: 400, error: 'invalid_input', message: 'missing parent_id' } as const;
  return null;
}

