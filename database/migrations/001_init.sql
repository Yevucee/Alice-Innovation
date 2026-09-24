-- Alice Innovation Library schema.
-- Source facts live on source_items and resources.
-- Machine-generated fields live only on resource_interpretations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_types (
  code text PRIMARY KEY,
  label text NOT NULL
);

INSERT INTO resource_types (code, label) VALUES
  ('SOLUTION', 'Solution'),
  ('TECHNOLOGY', 'Technology'),
  ('PROJECT', 'Project'),
  ('PERSON', 'Person'),
  ('ORGANISATION', 'Organisation'),
  ('CASE_STUDY', 'Case study'),
  ('METHOD', 'Method'),
  ('RESEARCH', 'Research'),
  ('TOOL', 'Tool'),
  ('PROGRAMME', 'Programme');

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  official_homepage text NOT NULL,
  collection_url text,
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN (
    'ACTIVE', 'PARTIAL', 'METADATA_ONLY', 'MANUAL', 'BLOCKED', 'BROKEN', 'PAUSED'
  )),
  access_class text NOT NULL CHECK (access_class IN (
    'PUBLIC', 'FREE_ACCOUNT_REQUIRED', 'PAID', 'RESTRICTED', 'UNAVAILABLE'
  )),
  ingestion_policy text NOT NULL DEFAULT '',
  adapter_type text NOT NULL,
  update_frequency text NOT NULL CHECK (update_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL')),
  last_successful_run timestamptz,
  last_attempted_run timestamptz,
  last_item_seen_at timestamptz,
  item_count integer NOT NULL DEFAULT 0,
  robots_checked_at timestamptz,
  terms_checked_at timestamptz,
  requests_per_minute integer NOT NULL DEFAULT 10,
  concurrency integer NOT NULL DEFAULT 1,
  discovery_method text NOT NULL DEFAULT '',
  discovery_notes text NOT NULL DEFAULT '',
  coverage_notes text NOT NULL DEFAULT '',
  historical_backfill text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL REFERENCES resource_types (code),
  canonical_title text NOT NULL,
  source_summary text NOT NULL DEFAULT '',
  extracted_index_text text NOT NULL DEFAULT '',
  evidence_stage text NOT NULL DEFAULT 'UNKNOWN' CHECK (evidence_stage IN (
    'UNKNOWN', 'IDEA', 'PROTOTYPE', 'PILOT', 'DEPLOYED', 'MULTIPLE_DEPLOYMENTS', 'SCALED'
  )),
  evidence_basis text NOT NULL DEFAULT 'UNKNOWN' CHECK (evidence_basis IN (
    'UNKNOWN', 'SELF_REPORTED', 'EDITORIALLY_CURATED', 'PROGRAMME_SELECTED',
    'FUNDER_SELECTED', 'INDEPENDENT_ASSESSMENT', 'ACADEMIC_OR_RESEARCH', 'PRIMARY_DOCUMENTATION'
  )),
  maturity_stage text NOT NULL DEFAULT 'UNKNOWN',
  cost_level text NOT NULL DEFAULT 'UNKNOWN',
  commercial_status text NOT NULL DEFAULT 'UNKNOWN',
  language text NOT NULL DEFAULT 'en',
  primary_country_code text,
  primary_country_name text,
  active boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'AUTO_INGESTED' CHECK (review_status IN (
    'AUTO_INGESTED', 'REVIEWED', 'ALICE_PICK', 'ARCHIVED'
  )),
  embedding vector(1536),
  embedding_model text,
  embedding_version text,
  embedded_at timestamptz,
  embedding_content_hash text,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(canonical_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(source_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_index_text, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ANN index is intentionally deferred until the catalogue is large enough
-- for HNSW or IVFFlat to be worth the build cost. The column is queryable now.

CREATE INDEX resources_search_vector_idx ON resources USING gin (search_vector);
CREATE INDEX resources_active_type_idx ON resources (resource_type) WHERE active;
CREATE INDEX resources_review_idx ON resources (review_status);

CREATE TABLE source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  canonical_url text NOT NULL,
  original_url text NOT NULL,
  title text NOT NULL,
  source_description text NOT NULL DEFAULT '',
  author_or_creator text,
  published_at timestamptz,
  updated_at_source timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_fetched_at timestamptz,
  content_hash text NOT NULL,
  http_etag text,
  http_last_modified text,
  raw_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_text text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  image_url text,
  active boolean NOT NULL DEFAULT true,
  miss_count integer NOT NULL DEFAULT 0,
  ingestion_run_id uuid,
  resource_id uuid REFERENCES resources (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id),
  UNIQUE (source_id, canonical_url)
);

CREATE INDEX source_items_resource_idx ON source_items (resource_id);
CREATE INDEX source_items_active_idx ON source_items (source_id) WHERE active;

CREATE TABLE resource_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  source_item_id uuid NOT NULL REFERENCES source_items (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'DESCRIBED_BY',
  confidence text NOT NULL DEFAULT 'EXACT',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, source_item_id)
);

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  organisation_type text NOT NULL DEFAULT 'OTHER' CHECK (organisation_type IN (
    'COMPANY', 'STARTUP', 'NGO', 'FOUNDATION', 'UNIVERSITY', 'RESEARCH_INSTITUTE',
    'GOVERNMENT', 'MULTILATERAL', 'FUND', 'ACCELERATOR', 'COMMUNITY_ORGANISATION', 'OTHER'
  )),
  country text,
  website text,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organisations_search_idx ON organisations USING gin (search_vector);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  professional_summary text NOT NULL DEFAULT '',
  role text,
  country text,
  public_profile_url text,
  organisation_id uuid REFERENCES organisations (id),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(professional_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(role, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_search_idx ON people USING gin (search_vector);

CREATE TABLE resource_organisations (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'DEVELOPED_BY',
  is_primary boolean NOT NULL DEFAULT false,
  source_item_id uuid REFERENCES source_items (id),
  PRIMARY KEY (resource_id, organisation_id, relationship)
);

CREATE TABLE resource_people (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'ASSOCIATED_WITH',
  source_item_id uuid REFERENCES source_items (id),
  PRIMARY KEY (resource_id, person_id, relationship)
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name text NOT NULL,
  country_code text,
  region text,
  continent text,
  city text,
  setting text CHECK (setting IS NULL OR setting IN ('RURAL', 'URBAN', 'MIXED')),
  UNIQUE (country_name, country_code, city)
);

CREATE TABLE resource_locations (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'DEPLOYED_IN',
  source_item_id uuid REFERENCES source_items (id),
  PRIMARY KEY (resource_id, location_id, relationship)
);

CREATE TABLE problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES problems (id)
);

CREATE TABLE sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES sectors (id)
);

CREATE TABLE technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES technologies (id)
);

CREATE TABLE resource_problems (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  origin text NOT NULL DEFAULT 'SOURCE' CHECK (origin IN ('SOURCE', 'INTERPRETATION')),
  PRIMARY KEY (resource_id, problem_id)
);

CREATE TABLE resource_sectors (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES sectors (id) ON DELETE CASCADE,
  origin text NOT NULL DEFAULT 'SOURCE' CHECK (origin IN ('SOURCE', 'INTERPRETATION')),
  PRIMARY KEY (resource_id, sector_id)
);

CREATE TABLE resource_technologies (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  technology_id uuid NOT NULL REFERENCES technologies (id) ON DELETE CASCADE,
  origin text NOT NULL DEFAULT 'SOURCE' CHECK (origin IN ('SOURCE', 'INTERPRETATION')),
  PRIMARY KEY (resource_id, technology_id)
);

CREATE TABLE resource_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  to_resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  relationship text NOT NULL,
  confidence text NOT NULL DEFAULT 'UNKNOWN',
  origin text NOT NULL DEFAULT 'SOURCE' CHECK (origin IN ('SOURCE', 'INTERPRETATION')),
  source_item_id uuid REFERENCES source_items (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  problem_statement text,
  how_it_works text,
  why_it_is_interesting text,
  intended_users text,
  implementation_requirements text,
  generated_by text NOT NULL,
  model text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  classification_version text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX resource_interpretations_resource_idx ON resource_interpretations (resource_id, generated_at DESC);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'SKIPPED')),
  items_discovered integer NOT NULL DEFAULT 0,
  items_fetched integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  items_unchanged integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  resources_created integer NOT NULL DEFAULT 0,
  resources_updated integer NOT NULL DEFAULT 0,
  duplicates_found integer NOT NULL DEFAULT 0,
  error_summary text,
  duration_ms integer
);

ALTER TABLE source_items
  ADD CONSTRAINT source_items_run_fk
  FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs (id) ON DELETE SET NULL;

CREATE TABLE ingestion_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources (id) ON DELETE SET NULL,
  ingestion_run_id uuid REFERENCES ingestion_runs (id) ON DELETE SET NULL,
  url text,
  stage text NOT NULL,
  http_status integer,
  error_type text NOT NULL,
  message text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX ingestion_errors_open_idx ON ingestion_errors (source_id, resolved, last_seen_at DESC);

CREATE TABLE backfill_checkpoints (
  source_id uuid PRIMARY KEY REFERENCES sources (id) ON DELETE CASCADE,
  cursor text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  other_resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'POSSIBLE_DUPLICATE' CHECK (status IN ('POSSIBLE_DUPLICATE', 'CONFIRMED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, other_resource_id, reason)
);

-- Record only. Nothing in the ingestor inserts these automatically.
CREATE TABLE source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  homepage text,
  notes text NOT NULL DEFAULT '',
  suggested_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'RECORDED' CHECK (status = 'RECORDED'),
  created_at timestamptz NOT NULL DEFAULT now()
);
