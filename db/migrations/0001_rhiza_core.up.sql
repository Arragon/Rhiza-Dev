CREATE TABLE rhiza_projects (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  active_node_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhiza_nodes (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES rhiza_projects(id) ON DELETE CASCADE,
  source_node_id uuid REFERENCES rhiza_nodes(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  summary text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('draft', 'active', 'resolved', 'stale', 'archived')),
  kind text NOT NULL CHECK (kind IN ('main', 'branch')),
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rhiza_projects
  ADD CONSTRAINT rhiza_projects_active_node_fk
  FOREIGN KEY (active_node_id) REFERENCES rhiza_nodes(id) ON DELETE SET NULL;

CREATE TABLE rhiza_segments (
  id uuid PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, ordinal)
);

CREATE TABLE rhiza_messages (
  id uuid PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES rhiza_segments(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('user', 'assistant', 'system', 'tool')),
  body text NOT NULL,
  manifest_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rhiza_anchors (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES rhiza_projects(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  message_id uuid REFERENCES rhiza_messages(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES rhiza_segments(id) ON DELETE CASCADE,
  selected_text text,
  start_offset integer CHECK (start_offset IS NULL OR start_offset >= 0),
  end_offset integer CHECK (end_offset IS NULL OR end_offset >= start_offset),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (message_id IS NOT NULL OR segment_id IS NOT NULL OR selected_text IS NULL)
);

CREATE TABLE rhiza_edges (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES rhiza_projects(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  anchor_id uuid REFERENCES rhiza_anchors(id) ON DELETE SET NULL,
  relation text NOT NULL CHECK (relation IN ('DERIVED_FROM', 'REFERENCES', 'RELATED_TO', 'MERGED_INTO')),
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_node_id <> target_node_id),
  UNIQUE (source_node_id, target_node_id, relation)
);

CREATE TABLE rhiza_context_manifests (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES rhiza_projects(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES rhiza_nodes(id) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE,
  mode text NOT NULL CHECK (mode IN ('Auto', 'Assisted', 'Strict')),
  provider text NOT NULL,
  model text NOT NULL,
  runtime text NOT NULL,
  estimated_tokens integer NOT NULL DEFAULT 0 CHECK (estimated_tokens >= 0),
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rhiza_messages
  ADD CONSTRAINT rhiza_messages_manifest_fk
  FOREIGN KEY (manifest_id) REFERENCES rhiza_context_manifests(id) ON DELETE SET NULL;

CREATE INDEX rhiza_nodes_project_idx ON rhiza_nodes(project_id, updated_at DESC);
CREATE INDEX rhiza_messages_node_idx ON rhiza_messages(node_id, created_at);
CREATE INDEX rhiza_edges_project_idx ON rhiza_edges(project_id);
CREATE INDEX rhiza_manifests_node_idx ON rhiza_context_manifests(node_id, created_at DESC);
