import type { Queryable } from "./pool.js";
import { compactResourcesByIds } from "./search.js";

export interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  item_count?: number;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function listCollections(db: Queryable, limit = 50): Promise<CollectionRow[]> {
  const rows = await db.query<CollectionRow & { item_count: string }>(
    `SELECT c.id::text, c.slug, c.title, c.description, c.is_public, c.created_at, c.updated_at,
            count(ci.resource_id)::text AS item_count
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.rows.map((row) => ({
    ...row,
    item_count: Number(row.item_count),
  }));
}

export async function getCollectionBySlug(db: Queryable, slug: string): Promise<CollectionRow | null> {
  const row = await db.query<CollectionRow>(
    `SELECT id::text, slug, title, description, is_public, created_at, updated_at
     FROM collections WHERE slug = $1`,
    [slug],
  );
  return row.rows[0] ?? null;
}

export async function createCollection(
  db: Queryable,
  input: { title: string; description?: string; is_public?: boolean },
): Promise<CollectionRow> {
  const base = slugify(input.title) || "collection";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await db.query<CollectionRow>(
        `INSERT INTO collections (slug, title, description, is_public)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text, slug, title, description, is_public, created_at, updated_at`,
        [slug, input.title.trim(), (input.description ?? "").trim(), input.is_public ?? false],
      );
      return row.rows[0];
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "23505") throw error;
      slug = `${base}-${attempt + 2}`;
    }
  }
  throw new Error("could not allocate collection slug");
}

export async function addResourceToCollection(
  db: Queryable,
  collectionId: string,
  resourceId: string,
  curatorNote = "",
): Promise<void> {
  const pos = await db.query<{ next: string }>(
    `SELECT coalesce(max(position), 0) + 1 AS next FROM collection_items WHERE collection_id = $1`,
    [collectionId],
  );
  await db.query(
    `INSERT INTO collection_items (collection_id, resource_id, curator_note, position)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (collection_id, resource_id)
     DO UPDATE SET curator_note = EXCLUDED.curator_note, added_at = now()`,
    [collectionId, resourceId, curatorNote.trim(), Number(pos.rows[0]?.next ?? 1)],
  );
  await db.query(`UPDATE collections SET updated_at = now() WHERE id = $1`, [collectionId]);
}

export async function addCollectionNote(
  db: Queryable,
  collectionId: string,
  body: string,
  authorLabel = "Alice",
): Promise<void> {
  await db.query(
    `INSERT INTO collection_notes (collection_id, body, author_label) VALUES ($1, $2, $3)`,
    [collectionId, body.trim(), authorLabel.trim() || "Alice"],
  );
  await db.query(`UPDATE collections SET updated_at = now() WHERE id = $1`, [collectionId]);
}

export async function collectionResourceIds(db: Queryable, collectionId: string): Promise<string[]> {
  const rows = await db.query<{ resource_id: string }>(
    `SELECT resource_id::text FROM collection_items
     WHERE collection_id = $1
     ORDER BY position ASC, added_at ASC`,
    [collectionId],
  );
  return rows.rows.map((row) => row.resource_id);
}

export async function collectionNotes(db: Queryable, collectionId: string): Promise<Array<{
  id: string;
  body: string;
  author_label: string;
  created_at: Date;
}>> {
  const rows = await db.query(
    `SELECT id::text, body, author_label, created_at
     FROM collection_notes WHERE collection_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [collectionId],
  );
  return rows.rows as Array<{ id: string; body: string; author_label: string; created_at: Date }>;
}

export async function collectionWithResources(db: Queryable, slug: string) {
  const collection = await getCollectionBySlug(db, slug);
  if (!collection) return null;
  const items = await db.query<{ resource_id: string; curator_note: string }>(
    `SELECT resource_id::text, curator_note FROM collection_items
     WHERE collection_id = $1 ORDER BY position ASC, added_at ASC`,
    [collection.id],
  );
  const ids = items.rows.map((row) => row.resource_id);
  const resources = await compactResourcesByIds(db, ids);
  const notes = await collectionNotes(db, collection.id);
  const noteByResource = new Map(items.rows.map((row) => [row.resource_id, row.curator_note]));
  return {
    collection,
    notes,
    resources: resources.map((resource) => ({
      ...resource,
      curator_note: noteByResource.get(resource.resource_id) ?? "",
    })),
  };
}
