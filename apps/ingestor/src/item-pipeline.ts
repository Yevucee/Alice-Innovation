import {
  buildEmbeddingText,
  embeddingTextContentHash,
  linkResourceTaxonomy,
  noteSemanticDuplicate,
  saveEmbedding,
  upsertDraft,
  type UpsertResult,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { inferTaxonomyFromText, PROBLEMS, SECTORS, TECHNOLOGIES } from "@alice/taxonomy";
import { evaluateDraftQuality, log, type NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import type pg from "pg";
import { classifyResource } from "./classifier.js";
import { embedTexts, embeddingSettings, embeddingVersion } from "./embeddings.js";
import { enrichOnIngest, enrichResourceOnIngest } from "./enrich.js";
import { prepareIngestDraft } from "./prepare-draft.js";
import { maybeTranslateSummaryForIngest } from "./ingest-summary-translate.js";
import { enhanceDraftWithQualityDetailIfNeeded } from "./quality-detail-fetch.js";
import { getRunFailureTracker } from "./run-failure-tracker.js";
import { IngestQualityDropError, shouldDropIngestAtQualityGate } from "./ingest-quality-drop.js";

export interface ProcessIngestItemResult {
  saved: UpsertResult;
  qualityFlagged: boolean;
  enriched: boolean;
  embedded: boolean;
  steps: string[];
}

export interface ProcessIngestItemDeps {
  embedTextsFn?: (texts: string[]) => Promise<number[][] | null>;
  enrichFn?: typeof enrichResourceOnIngest;
  listingContentHash?: string;
}

async function loadEmbeddingRow(db: Queryable, resourceId: string) {
  const row = await db.query<{
    canonical_title: string;
    source_summary: string;
    extracted_index_text: string;
    primary_country_name: string | null;
    problems: string[];
    sectors: string[];
    technologies: string[];
    countries: string[];
    interpretation_problem_statement: string | null;
    review_status: string;
    evidence_stage: string;
  }>(
    `SELECT r.canonical_title,
            r.source_summary,
            r.extracted_index_text,
            r.primary_country_name,
            r.review_status,
            r.evidence_stage,
            COALESCE((
              SELECT array_agg(DISTINCT p.name ORDER BY p.name)
              FROM resource_problems rp JOIN problems p ON p.id = rp.problem_id
              WHERE rp.resource_id = r.id
            ), '{}') AS problems,
            COALESCE((
              SELECT array_agg(DISTINCT sec.name ORDER BY sec.name)
              FROM resource_sectors rs JOIN sectors sec ON sec.id = rs.sector_id
              WHERE rs.resource_id = r.id
            ), '{}') AS sectors,
            COALESCE((
              SELECT array_agg(DISTINCT t.name ORDER BY t.name)
              FROM resource_technologies rt JOIN technologies t ON t.id = rt.technology_id
              WHERE rt.resource_id = r.id
            ), '{}') AS technologies,
            COALESCE((
              SELECT array_agg(DISTINCT loc.country_name ORDER BY loc.country_name)
              FROM resource_locations rl JOIN locations loc ON loc.id = rl.location_id
              WHERE rl.resource_id = r.id
            ), '{}') AS countries,
            (
              SELECT ri.problem_statement FROM resource_interpretations ri
              WHERE ri.resource_id = r.id ORDER BY ri.generated_at DESC LIMIT 1
            ) AS interpretation_problem_statement
     FROM resources r WHERE r.id = $1`,
    [resourceId],
  );
  return row.rows[0] ?? null;
}

/**
 * Canonical per-item ingest pipeline (all adapters must flow through this):
 * prepare draft → quality gate → upsert → LLM enrich → taxonomy → embed → classify.
 */
export async function processIngestItem(
  db: pg.Pool,
  source: SourceRecord,
  parsedDraft: NormalisedDraft,
  runId: string,
  deps: ProcessIngestItemDeps = {},
): Promise<ProcessIngestItemResult> {
  const steps: string[] = [];
  let draft = prepareIngestDraft(parsedDraft, source);
  draft = await enhanceDraftWithQualityDetailIfNeeded(source, draft, getRunFailureTracker());
  await maybeTranslateSummaryForIngest(draft);
  steps.push("prepare");

  const quality = evaluateDraftQuality(draft);
  steps.push("quality_gate");
  if (shouldDropIngestAtQualityGate(source.id, quality.needsReview, quality.reasons)) {
    throw new IngestQualityDropError(quality.reasons);
  }
  const reviewStatus = quality.needsReview ? "NEEDS_REVIEW" : "AUTO_INGESTED";

  const saved = await upsertDraft(db, source.id, draft, runId, {
    reviewStatus,
    skipOrgPersonLinks: quality.skipOrgPersonLinks,
    qualityReasons: quality.reasons,
    listingContentHash: deps.listingContentHash,
  });
  steps.push("upsert");

  if (saved.outcome === "unchanged") {
    return {
      saved,
      qualityFlagged: quality.needsReview,
      enriched: false,
      embedded: false,
      steps,
    };
  }

  const orgRow = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM resource_organisations WHERE resource_id = $1::uuid) AS exists`,
    [saved.resourceId],
  );
  let enriched = false;
  if (enrichOnIngest()) {
    const enrichFn = deps.enrichFn ?? enrichResourceOnIngest;
    const enrichResult = await enrichFn(db, saved.resourceId, {
      title: draft.title,
      summary: draft.sourceSummary,
      text: draft.extractedText,
      countryName: draft.countryName,
      evidenceStage: draft.evidenceStage,
      hasOrganisation: orgRow.rows[0]?.exists === true,
      reviewStatus,
    });
    enriched = enrichResult.applied;
    if (enrichResult.applied) steps.push("enrich");
    else steps.push("enrich_skipped");
  } else {
    steps.push("enrich_deferred");
  }

  const taxonomy = inferTaxonomyFromText({
    title: draft.title,
    summary: draft.sourceSummary,
    text: draft.extractedText,
    tags: draft.tags,
  });
  await linkResourceTaxonomy(db, saved.resourceId, taxonomy);
  steps.push("taxonomy");

  let embedded = false;
  try {
    const row = await loadEmbeddingRow(db, saved.resourceId);
    if (row) {
      const embedInput = buildEmbeddingText({
        canonical_title: row.canonical_title,
        source_summary: row.source_summary,
        extracted_index_text: row.extracted_index_text,
        primary_country_name: row.primary_country_name,
        countries: row.countries,
        problems: row.problems,
        sectors: row.sectors,
        technologies: row.technologies,
        interpretation_problem_statement: row.interpretation_problem_statement,
      });
      const embedFn = deps.embedTextsFn ?? embedTexts;
      const vectors = await embedFn([embedInput]);
      const vector = vectors?.[0];
      if (vector && vector.length === 1536) {
        const settings = embeddingSettings();
        await saveEmbedding(
          db,
          saved.resourceId,
          vector,
          settings.model,
          embeddingVersion(settings),
          embeddingTextContentHash(embedInput),
        );
        embedded = true;
        steps.push("embed");
        await noteSemanticDuplicate(db, saved.resourceId);
      } else if (vector) {
        log("warn", "embedding_dimensions", { source_id: source.id, length: vector.length });
        steps.push("embed_skipped_dims");
      } else {
        steps.push("embed_skipped");
      }
    }
    await classifyResource(db, saved.resourceId, {
      title: draft.title,
      summary: draft.sourceSummary,
      text: draft.extractedText,
    });
    steps.push("classify");
  } catch (error) {
    log("warn", "post_process_failed", {
      source_id: source.id,
      resource_id: saved.resourceId,
      message: error instanceof Error ? error.message : String(error),
    });
    steps.push("post_process_failed");
  }

  return {
    saved,
    qualityFlagged: quality.needsReview,
    enriched,
    embedded,
    steps,
  };
}
