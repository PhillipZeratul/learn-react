-- Add parent_id and sort_order to routine_time_tracker_tags
ALTER TABLE routine_time_tracker_tags ADD COLUMN parent_id TEXT;
ALTER TABLE routine_time_tracker_tags ADD COLUMN sort_order REAL DEFAULT 0;

-- Optional: Indexing for performance
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON routine_time_tracker_tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_sort_order ON routine_time_tracker_tags(sort_order);
