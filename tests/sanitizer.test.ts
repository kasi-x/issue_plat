import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/lib/sanitizer.js';

describe('sanitizeHtml', () => {
  it('allows basic formatting tags', () => {
    const input = '<strong>bold</strong> <em>i</em> <code>x()</code><br>';
    expect(sanitizeHtml(input)).toBe('<strong>bold</strong> <em>i</em> <code>x()</code><br>');
  });

  it('sanitizes anchors with allowed hrefs', () => {
    const input = '<a href="https://example.com" onclick="alert(1)">ok</a>';
    expect(sanitizeHtml(input)).toBe('<a href="https://example.com" rel="noopener nofollow ugc">ok</a>');
  });

  it('strips disallowed anchors', () => {
    const input = '<a href="javascript:alert(1)">bad</a>';
    expect(sanitizeHtml(input)).toBe('bad');
  });

  it('removes unknown tags but keeps text', () => {
    const input = '<div>text <span>inside</span></div>';
    expect(sanitizeHtml(input)).toBe('text inside');
  });
});
