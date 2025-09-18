import { sanitizeHtml } from '../sanitizer.js';
import {
  AnnotationKind,
  BODY_HTML_MAX_LENGTH,
  MODERATION_TEXT_LENGTH_THRESHOLD,
  MODERATION_URL_THRESHOLD,
  normalizeAnnotationKind,
} from './constants.js';

export type PreparedAnnotationContent = {
  sanitizedHtml: string;
  urlCount: number;
  tooLong: boolean;
  state: 'published' | 'pending';
  kind: AnnotationKind;
  signals: {
    url_count: number;
    too_long: boolean;
    idempotency_key: string;
  };
};

// Prepare sanitized HTML, moderation signals, and normalized kind for storage.
export function prepareAnnotationContent(bodyHtml: string, idempotencyKey: string, kindInput?: unknown): PreparedAnnotationContent {
  const urlCount = (bodyHtml.match(/https?:\/\//gi) || []).length;
  const tooLong = bodyHtml.length > MODERATION_TEXT_LENGTH_THRESHOLD;
  const state: 'published' | 'pending' = tooLong || urlCount > MODERATION_URL_THRESHOLD ? 'pending' : 'published';
  const sanitizedHtml = sanitizeHtml(bodyHtml.slice(0, BODY_HTML_MAX_LENGTH));
  const kind = normalizeAnnotationKind(kindInput);

  return {
    sanitizedHtml,
    urlCount,
    tooLong,
    state,
    kind,
    signals: {
      url_count: urlCount,
      too_long: tooLong,
      idempotency_key: idempotencyKey,
    },
  };
}

// If the same quote was used moments ago, force the annotation into review.
export function applyRepeatHold(currentState: 'published' | 'pending', repeatCount: number): 'published' | 'pending' {
  return repeatCount > 0 ? 'pending' : currentState;
}
