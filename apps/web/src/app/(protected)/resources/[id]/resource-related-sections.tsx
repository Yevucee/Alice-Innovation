import {
  diverseApproachesForResource,
  embeddingCatalogueCoverage,
  findSimilar,
} from "@alice/database";
import { ResourceCard } from "@/components/resource-card";
import type { Queryable } from "@alice/database";

export async function ResourceRelatedSections({
  db,
  resourceId,
  queryText,
}: {
  db: Queryable;
  resourceId: string;
  queryText: string;
}) {
  const [similar, embeddingCoverage, diverse] = await Promise.all([
    findSimilar(db, resourceId, 4),
    embeddingCatalogueCoverage(db),
    queryText ? diverseApproachesForResource(db, resourceId, queryText, 6) : Promise.resolve([]),
  ]);

  const similarityIndexBuilding = embeddingCoverage.pct < 50;

  return (
    <>
      {diverse.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Different approaches to the same problem</h2>
          <p className="mt-1 text-xs text-muted">Hybrid search with mechanism-level diversity (technology/sector buckets).</p>
          <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2">
            {diverse.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : null}

      {similar.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <p className="mt-1 text-xs text-muted">Similar indexed content by meaning.</p>
          <div className="mt-4 grid auto-rows-fr gap-4 sm:grid-cols-2">
            {similar.map((item) => (
              <ResourceCard key={item.resource_id} resource={item} />
            ))}
          </div>
        </section>
      ) : similarityIndexBuilding ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-sm font-medium">Related ideas</h2>
          <p className="mt-1 text-xs text-muted">
            Building similarity index… ({embeddingCoverage.with_embedding.toLocaleString()} of{" "}
            {embeddingCoverage.active.toLocaleString()} resources embedded so far).
          </p>
        </section>
      ) : null}
    </>
  );
}
