-- Africa innovation hub directory: organisations, provenance, and ingestion candidates.

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS hub_subtype text,
  ADD COLUMN IF NOT EXISTS is_innovation_hub boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_host text,
  ADD COLUMN IF NOT EXISTS hub_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_organisation_type_check;
ALTER TABLE organisations ADD CONSTRAINT organisations_organisation_type_check CHECK (
  organisation_type IN (
    'COMPANY', 'STARTUP', 'NGO', 'FOUNDATION', 'UNIVERSITY', 'RESEARCH_INSTITUTE',
    'GOVERNMENT', 'MULTILATERAL', 'FUND', 'ACCELERATOR', 'COMMUNITY_ORGANISATION',
    'INNOVATION_HUB', 'INCUBATOR', 'MAKERSPACE', 'FABLAB', 'ECOSYSTEM_ORGANISATION', 'OTHER'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS organisations_website_host_unique
  ON organisations (website_host)
  WHERE website_host IS NOT NULL AND website_host <> '';

CREATE INDEX IF NOT EXISTS organisations_innovation_hub_idx
  ON organisations (is_innovation_hub)
  WHERE is_innovation_hub = true;

ALTER TABLE organisations DROP CONSTRAINT IF EXISTS organisations_hub_subtype_check;
ALTER TABLE organisations ADD CONSTRAINT organisations_hub_subtype_check CHECK (
  hub_subtype IS NULL OR hub_subtype IN (
    'INNOVATION_HUB', 'INCUBATOR', 'ACCELERATOR', 'MAKERSPACE', 'FABLAB',
    'UNIVERSITY_INNOVATION_CENTRE', 'ECOSYSTEM_ORGANISATION', 'OTHER'
  )
);

CREATE TABLE hub_directories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('INGESTION', 'DISCOVERY_ONLY', 'MANUAL_ONLY', 'RESEARCH_ONLY')),
  homepage_url text,
  notes text NOT NULL DEFAULT ''
);

CREATE TABLE hub_directory_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_slug text NOT NULL REFERENCES hub_directories (slug) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  external_id text NOT NULL DEFAULT '',
  directory_profile_url text,
  raw_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (directory_slug, organisation_id),
  UNIQUE (directory_slug, external_id)
);

CREATE INDEX hub_directory_discoveries_org_idx ON hub_directory_discoveries (organisation_id);

CREATE TABLE organisation_network_memberships (
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  network_slug text NOT NULL,
  member_ref text NOT NULL DEFAULT '',
  PRIMARY KEY (organisation_id, network_slug)
);

CREATE TABLE innovation_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  proposed_slug text NOT NULL UNIQUE,
  homepage text,
  collection_url text,
  catalogue_capability text NOT NULL DEFAULT 'UNKNOWN' CHECK (catalogue_capability IN (
    'UNKNOWN', 'NONE', 'PORTFOLIO', 'STARTUP_DIRECTORY', 'PROGRAMME_COHORT',
    'CHALLENGE_SHOWCASE', 'CASE_STUDIES', 'MIXED'
  )),
  access_class text NOT NULL DEFAULT 'PUBLIC',
  access_status text NOT NULL DEFAULT 'UNVERIFIED',
  robots_allowed boolean,
  robots_checked_at timestamptz,
  terms_checked_at timestamptz,
  verification_notes text NOT NULL DEFAULT '',
  linked_source_slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX innovation_source_candidates_org_idx ON innovation_source_candidates (organisation_id);

INSERT INTO hub_directories (slug, name, role, homepage_url, notes) VALUES
  ('afrilabs', 'AfriLabs', 'INGESTION', 'https://www.afrilabs.com/', 'WP REST post type hub (~500+ members).'),
  ('ghana-hubs-network', 'Ghana Hubs Network', 'DISCOVERY_ONLY', 'https://ghanahubsnetwork.com/', 'No public machine-readable member list; seed + manual enrichment.'),
  ('isn-nigeria', 'Innovation Support Network Nigeria', 'DISCOVERY_ONLY', NULL, 'URL TBD; seed known hubs.'),
  ('startup-uganda', 'Startup Uganda', 'DISCOVERY_ONLY', NULL, 'URL TBD; seed known hubs.'),
  ('impact-hub-global', 'Impact Hub Global', 'DISCOVERY_ONLY', 'https://impacthub.net/', 'Network site often bot-walled; African locations via seed.'),
  ('fablabs-io', 'FabLabs.io', 'INGESTION', 'https://www.fablabs.io/', 'Public labs API; filter African country codes.'),
  ('orange-digital-centers', 'Orange Digital Centers', 'DISCOVERY_ONLY', 'https://www.orange.com/', 'National ODC sites; manual/seed led.'),
  ('egypt-tiec', 'Egypt TIEC / CREATIVA / EgyptInnovate', 'DISCOVERY_ONLY', 'https://www.tiec.gov.eg/', 'Egypt ecosystem orgs; verify per site.'),
  ('global-innovation-gathering', 'Global Innovation Gathering', 'DISCOVERY_ONLY', 'https://globalinnovationgathering.org/', 'Ecosystem network; African members via events/seed.'),
  ('briter', 'Briter', 'RESEARCH_ONLY', 'https://briter.co/', 'Research/discovery only — do not scrape paid datasets.'),
  ('vc4a', 'VC4A', 'MANUAL_ONLY', 'https://vc4a.com/', 'Manual only unless permitted RSS/API verified.'),
  ('seed-organisations', 'Curated hub seed list', 'DISCOVERY_ONLY', NULL, 'First-class hubs from config/hub-seed-organisations.yaml.')
ON CONFLICT (slug) DO NOTHING;
