/** SQL fragment: catalogue innovation rows (excludes editorial ARTICLE). */
export const EXCLUDE_ARTICLE_RESOURCE_SQL = `AND r.resource_type <> 'ARTICLE'`;
