import { load } from "cheerio";

/** Extract organisation answer from a MIT Solve solution detail HTML page. */
export function extractMitSolveOrganisationFromHtml(html: string): string | null {
  const $ = load(html);
  const answers = new Map<string, string>();
  $("div").each((_, element) => {
    const question = $(element).find(".font-semibold").first().text().replace(/\s+/g, " ").trim();
    const answer = $(element).find(".text-18, .lg\\:text-20").first().text().replace(/\s+/g, " ").trim();
    if (question && answer) answers.set(question.toLowerCase(), answer);
  });
  const organisationEntry =
    [...answers.entries()].find(([question]) =>
      /name of your organization/i.test(question) || /name of your organisation/i.test(question),
    ) ??
    [...answers.entries()].find(
      ([question]) =>
        question.includes("organization") &&
        !/legal|form|type|registered|profit|structure|status/i.test(question),
    );
  return organisationEntry?.[1]?.trim() ?? null;
}
