Maintenance queries belong in Postgres: `ingestion_runs`, `ingestion_errors`, and `get_library_stats`.

Do not hard-delete source items. A full catalogue run marks an item inactive only after it is missing twice.
