export type TextQuoteSelector = {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
};

export type TextPositionSelector = {
  type: 'TextPositionSelector';
  start: number;
  end: number;
  unit: 'codepoint';
};

export type AnnotationTarget = {
  source: string; // e.g., /posts/:slug
  selector: Array<TextQuoteSelector | TextPositionSelector>;
};

export type AnnotationSelectorsEnvelope = {
  type: 'Annotation';
  target: AnnotationTarget;
};

export type CreateAnnotationBody = {
  post_slug: string;
  display_name: string | null;
  body_html: string;
  selectors: AnnotationSelectorsEnvelope;
  quote: string;
  turnstile_token: string;
  idempotency_key: string;
};

export type ReplyAnnotationBody = CreateAnnotationBody & {
  parent_id: number;
};

export type ReportAnnotationBody = {
  annotation_id: number;
  reason: string;
};

export type ApiErrorCode =
  | 'invalid_input'
  | 'too_long'
  | 'too_many_links'
  | 'missing_selector'
  | 'unauthorized'
  | 'bad_origin'
  | 'bot_suspected'
  | 'rate_limited'
  | 'not_found'
  | 'conflict'
  | 'internal_error';

export type JsonValue = unknown;

export interface Env {
  DB: D1Database;
  ORIGIN_HOST?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  SALT_IP_HASH?: string;
}
