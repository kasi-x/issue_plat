import type { CreateAnnotationBody, ReplyAnnotationBody } from '../types.js';
import { normalizeAnnotationKind } from './constants.js';

const DISPLAY_NAME_MAX = 32;

export type AnnotationValidationError = {
  status: number;
  error: 'invalid_input' | 'too_long';
  message?: string;
};

export type AnnotationBodyInput = CreateAnnotationBody & Partial<ReplyAnnotationBody>;

export type AnnotationValidationResult<T extends AnnotationBodyInput = AnnotationBodyInput> =
  | { ok: true; body: T }
  | { ok: false; error: AnnotationValidationError };

function hasRequiredSelectors(body: any): boolean {
  const selectors = body?.selectors?.target?.selector;
  if (!Array.isArray(selectors)) return false;
  const hasQuote = selectors.some((s: any) => s?.type === 'TextQuoteSelector');
  const hasPosition = selectors.some((s: any) => s?.type === 'TextPositionSelector');
  return hasQuote && hasPosition;
}

function missingBasicFields(body: any): boolean {
  return !body?.post_slug || !body?.body_html || !body?.selectors || !body?.quote || !body?.turnstile_token || !body?.idempotency_key;
}

// Validate required fields and produce a normalized body payload shared by both runtimes.
export function validateAnnotationBody<T extends AnnotationBodyInput = AnnotationBodyInput>(
  input: unknown,
  opts: { isReply?: boolean } = {}
): AnnotationValidationResult<T> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: { status: 400, error: 'invalid_input' } };
  }

  const body = input as AnnotationBodyInput;
  if (missingBasicFields(body)) {
    return { ok: false, error: { status: 400, error: 'invalid_input' } };
  }

  if (!hasRequiredSelectors(body)) {
    return { ok: false, error: { status: 400, error: 'invalid_input', message: 'missing selectors' } };
  }

  if (body.display_name && body.display_name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: { status: 400, error: 'too_long' } };
  }

  if (opts.isReply && !body.parent_id) {
    return { ok: false, error: { status: 400, error: 'invalid_input', message: 'missing parent_id' } };
  }

  const kind = normalizeAnnotationKind(body.kind);
  const normalized = { ...body, kind } as T;

  return { ok: true, body: normalized };
}
