import { loadSeedOrganisations } from "@alice/hub-discovery";

/** `linked_portfolio_source` values from `config/hub-seed-organisations.yaml`. */
export function hubPortfolioSourceSlugs(): string[] {
  const slugs = new Set<string>();
  for (const row of loadSeedOrganisations()) {
    if (row.linked_portfolio_source) {
      slugs.add(row.linked_portfolio_source);
    }
  }
  return [...slugs].sort();
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("hub-portfolio-sources.ts");
if (isMain) {
  for (const slug of hubPortfolioSourceSlugs()) {
    console.log(slug);
  }
}
