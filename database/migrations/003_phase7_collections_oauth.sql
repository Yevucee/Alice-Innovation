-- Curated collections, Alice notes, and MCP OAuth access tokens.

CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE collection_items (
  collection_id uuid NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  curator_note text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, resource_id)
);

CREATE INDEX collection_items_resource_idx ON collection_items (resource_id);

CREATE TABLE collection_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  body text NOT NULL,
  author_label text NOT NULL DEFAULT 'Alice',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX collection_notes_collection_idx ON collection_notes (collection_id, created_at DESC);

CREATE TABLE mcp_access_tokens (
  token_hash text PRIMARY KEY,
  client_id text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['mcp'],
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mcp_access_tokens_expires_idx ON mcp_access_tokens (expires_at);
