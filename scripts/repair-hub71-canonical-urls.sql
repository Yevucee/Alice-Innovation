-- One-off repair for hub71-startup-directory legacy source_items where canonical_url
-- was stored from malformed website fields (pre-#87 discover).
UPDATE source_items si
SET canonical_url = 'https://www.hub71.com/startups/' || si.external_id,
    updated_at = now()
FROM sources s
WHERE si.source_id = s.id
  AND s.slug = 'hub71-startup-directory'
  AND si.external_id IS NOT NULL
  AND btrim(si.external_id) <> ''
  AND (
    si.canonical_url LIKE ':%'
    OR si.canonical_url !~ '^https?://'
  );
