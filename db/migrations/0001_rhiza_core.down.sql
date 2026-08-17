ALTER TABLE IF EXISTS rhiza_messages DROP CONSTRAINT IF EXISTS rhiza_messages_manifest_fk;
DROP TABLE IF EXISTS rhiza_context_manifests;
DROP TABLE IF EXISTS rhiza_edges;
DROP TABLE IF EXISTS rhiza_anchors;
DROP TABLE IF EXISTS rhiza_messages;
DROP TABLE IF EXISTS rhiza_segments;
ALTER TABLE IF EXISTS rhiza_projects DROP CONSTRAINT IF EXISTS rhiza_projects_active_node_fk;
DROP TABLE IF EXISTS rhiza_nodes;
DROP TABLE IF EXISTS rhiza_projects;
