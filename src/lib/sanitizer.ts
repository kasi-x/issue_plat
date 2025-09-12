// Minimal inline HTML sanitizer per spec: allow a, strong, em, code, br.
// - a[href] limited to http/https/mailto, add rel attrs
// - strip all other tags/attributes

const ALLOWED_SIMPLE = new Set(['strong', 'em', 'code', 'br']);

function sanitizeAnchorPair(opening: string, inner: string): string {
  const hrefMatch = opening.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? '';
  const safe = /^(https?:|mailto:)/i.test(href);
  if (!safe) return inner; // drop the tag, keep inner text
  const escapedHref = href.replace(/"/g, '&quot;');
  return `<a href="${escapedHref}" rel="noopener nofollow ugc">${inner}</a>`;
}

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  // Normalize newlines
  let out = input.replace(/\r\n?/g, '\n');

  // Handle anchors by processing pairs so disallowed ones are removed cleanly
  out = out.replace(/(<a\b[^>]*>)([\s\S]*?)<\s*\/\s*a\s*>/gi, (_m, open: string, inner: string) => sanitizeAnchorPair(open, inner));

  // Strip attributes from simple tags and normalize closers
  out = out.replace(/<\s*(strong|em|code)\b[^>]*>/gi, (_m, tag) => `<${(tag as string).toLowerCase()}>`);
  out = out.replace(/<\s*\/\s*(strong|em|code)\s*>/gi, (_m, tag) => `</${(tag as string).toLowerCase()}>`);

  // Normalize <br>, remove attributes
  out = out.replace(/<\s*br\b[^>]*\/?\s*>/gi, '<br>');

  // Remove any other tags entirely but keep their text content
  out = out.replace(/<\/(?!a|strong|em|code)\s*[^>]+>/gi, '');
  out = out.replace(/<(?!\/?(?:a|strong|em|code|br)\b)[^>]*>/gi, '');

  // Remove event-handler attributes that might have slipped through (defense-in-depth)
  out = out.replace(/ on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Remove javascript: in any href occurrences (already filtered, but double-sure)
  out = out.replace(/href\s*=\s*(["'])\s*javascript:[^\1]*\1/gi, '');

  return out;
}

export default sanitizeHtml;
