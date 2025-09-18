-- Additional indexes for listing and sorting annotations efficiently
CREATE INDEX IF NOT EXISTS idx_annotations_post_state_created
  ON annotations(post_id, state, created_at);

