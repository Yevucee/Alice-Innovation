Historical backfill is `npm run ingest -- --full --source <id>`.

Checkpoints live in `backfill_checkpoints`. Re-running continues after the last completed URL. Pass `--limit` only for a sample; a limited run does not advance disappearance checks.
