import { loadSources } from "@alice/source-registry";
import { resolve } from "node:path";

const sources = loadSources(resolve(process.cwd(), "config/sources.yaml"));
const slugs = sources
  .filter((s) => s.category === "asia-innovation" && s.enabled && s.status !== "BLOCKED")
  .map((s) => s.id)
  .sort();

for (const slug of slugs) {
  console.log(slug);
}
