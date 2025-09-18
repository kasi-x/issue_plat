import { describe, it, expect } from 'vitest';
import { prepareAnnotationContent, applyRepeatHold } from '../src/lib/annotations/content.js';
import { BODY_HTML_MAX_LENGTH } from '../src/lib/annotations/constants.js';
import { validateAnnotationBody } from '../src/lib/annotations/validation.js';

const baseSelectors = {
  type: 'Annotation',
  target: {
    source: '/posts/test',
    selector: [
      { type: 'TextQuoteSelector', exact: 'hello world' },
      { type: 'TextPositionSelector', start: 0, end: 11, unit: 'codepoint' },
    ],
  },
};

describe('prepareAnnotationContent', () => {
  it('flags long or URL-heavy content and sanitizes HTML', () => {
    const bodyHtml = [
      'Check these links:',
      '<a href="https://a.com">a</a>',
      '<a href="https://b.com">b</a>',
      '<a href="https://c.com">c</a>',
      '<a href="https://d.com">d</a>',
      '<script>alert(1)</script>',
    ].join(' ');

    const prepared = prepareAnnotationContent(bodyHtml, 'idem-1', 'question');

    expect(prepared.state).toBe('pending');
    expect(prepared.signals.url_count).toBe(4);
    expect(prepared.signals.idempotency_key).toBe('idem-1');
    expect(prepared.sanitizedHtml).not.toContain('<script>');
    expect(prepared.sanitizedHtml).toContain('alert(1)');
    expect(prepared.kind).toBe('question');
  });

  it('trims body HTML to the configured maximum length', () => {
    const longHtml = 'x'.repeat(BODY_HTML_MAX_LENGTH + 500);
    const prepared = prepareAnnotationContent(longHtml, 'idem-2');
    expect(prepared.sanitizedHtml.length).toBe(BODY_HTML_MAX_LENGTH);
    expect(prepared.state).toBe('pending');
  });
});

describe('applyRepeatHold', () => {
  it('forces pending when repeat count is positive', () => {
    expect(applyRepeatHold('published', 1)).toBe('pending');
    expect(applyRepeatHold('pending', 5)).toBe('pending');
  });

  it('keeps original state when repeat count is zero', () => {
    expect(applyRepeatHold('published', 0)).toBe('published');
  });
});

describe('validateAnnotationBody', () => {
  const baseBody = {
    post_slug: 'example-post',
    display_name: 'Alice',
    body_html: '<strong>hello</strong>',
    selectors: baseSelectors,
    quote: 'hello world',
    turnstile_token: 'token-123',
    idempotency_key: 'idem-3',
    kind: 'question',
  } as const;

  it('accepts a well-formed create payload and normalizes the kind', () => {
    const result = validateAnnotationBody(baseBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.kind).toBe('question');
    }
  });

  it('rejects payloads missing required selectors', () => {
    const missingSelectors = {
      ...baseBody,
      selectors: {
        ...baseSelectors,
        target: {
          ...baseSelectors.target,
          selector: [{ type: 'TextQuoteSelector', exact: 'hello world' }],
        },
      },
    } as const;

    const result = validateAnnotationBody(missingSelectors);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('invalid_input');
      expect(result.error.message).toBe('missing selectors');
    }
  });

  it('rejects payloads with overly long display names', () => {
    const tooLongName = {
      ...baseBody,
      display_name: 'x'.repeat(40),
    };
    const result = validateAnnotationBody(tooLongName);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('too_long');
    }
  });

  it('requires parent_id when validating replies', () => {
    const replyResult = validateAnnotationBody(baseBody, { isReply: true });
    expect(replyResult.ok).toBe(false);
    if (!replyResult.ok) {
      expect(replyResult.error.error).toBe('invalid_input');
    }

    const replyBody = { ...baseBody, parent_id: 123 };
    const okReply = validateAnnotationBody(replyBody, { isReply: true });
    expect(okReply.ok).toBe(true);
  });
});
