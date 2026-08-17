ALTER TABLE rhiza_messages
  ADD COLUMN operation text NOT NULL DEFAULT 'send' CHECK (operation IN ('send', 'retry', 'regenerate', 'edit-resend')),
  ADD COLUMN source_message_id uuid REFERENCES rhiza_messages(id) ON DELETE SET NULL,
  ADD COLUMN version_group_id uuid,
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN reply_to_message_id uuid REFERENCES rhiza_messages(id) ON DELETE SET NULL,
  ADD COLUMN usage jsonb,
  ADD COLUMN reasoning text,
  ADD COLUMN tool_calls jsonb;

CREATE TABLE rhiza_attachments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES rhiza_projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  kind text NOT NULL CHECK (kind IN ('file', 'image')),
  storage_key text NOT NULL UNIQUE,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhiza_message_attachments (
  message_id uuid NOT NULL REFERENCES rhiza_messages(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES rhiza_attachments(id) ON DELETE CASCADE,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  PRIMARY KEY (message_id, attachment_id)
);

CREATE INDEX rhiza_message_versions_idx ON rhiza_messages(version_group_id, version);
CREATE INDEX rhiza_attachments_project_idx ON rhiza_attachments(project_id, created_at DESC);
