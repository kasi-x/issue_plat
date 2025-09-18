export const ANNOTATION_KIND_DEFAULT = 'comment' as const;

export const ANNOTATION_KINDS = [
  'comment',
  'question',
  'citation',
  'critique',
  'praise',
] as const;

export type AnnotationKind = typeof ANNOTATION_KINDS[number];

const KIND_SET = new Set<AnnotationKind>(ANNOTATION_KINDS);

export function normalizeAnnotationKind(input: unknown): AnnotationKind {
  return KIND_SET.has(input as AnnotationKind)
    ? (input as AnnotationKind)
    : ANNOTATION_KIND_DEFAULT;
}

export const BODY_HTML_MAX_LENGTH = 8000;
export const MODERATION_TEXT_LENGTH_THRESHOLD = 2000;
export const MODERATION_URL_THRESHOLD = 3;
