DROP TABLE IF EXISTS rhiza_message_attachments;
DROP TABLE IF EXISTS rhiza_attachments;
DROP INDEX IF EXISTS rhiza_message_versions_idx;
ALTER TABLE rhiza_messages
  DROP COLUMN IF EXISTS tool_calls,
  DROP COLUMN IF EXISTS reasoning,
  DROP COLUMN IF EXISTS usage,
  DROP COLUMN IF EXISTS reply_to_message_id,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS version_group_id,
  DROP COLUMN IF EXISTS source_message_id,
  DROP COLUMN IF EXISTS operation;
