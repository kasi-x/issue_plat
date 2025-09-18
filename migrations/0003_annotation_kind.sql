-- Add kind to annotations to support comment variations
ALTER TABLE annotations ADD COLUMN kind TEXT NOT NULL DEFAULT 'comment';
CREATE INDEX IF NOT EXISTS idx_annotations_kind ON annotations(kind);

