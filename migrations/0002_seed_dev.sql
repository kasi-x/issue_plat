-- Development seed: sample post for local testing
INSERT OR IGNORE INTO posts (slug, html, plain_text, revision, content_hash, published_at)
VALUES (
  'hello-world',
  '<h1>Hello, World</h1><p>This is a sample post used for local testing of annotations.</p>',
  'Hello, World\n\nThis is a sample post used for local testing of annotations.',
  1,
  NULL,
  datetime('now')
);
