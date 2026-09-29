import { robotsAllows } from "../../../apps/ingestor/src/robots.js";
import type { DiscoveryContext } from "./types.js";

export async function checkRobotsForUrl(
  ctx: DiscoveryContext,
  url: string,
): Promise<{ allowed: boolean; notes: string }> {
  try {
    const target = new URL(url);
    const robotsUrl = `${target.origin}/robots.txt`;
    const page = await ctx.fetchText(robotsUrl);
    if (page.status >= 400) {
      return { allowed: false, notes: `robots_http_${page.status}` };
    }
    const decision = robotsAllows(page.body, ctx.userAgent, target.pathname);
    return { allowed: decision.allowed, notes: decision.allowed ? "robots_ok" : "robots_disallow" };
  } catch (error) {
    return { allowed: false, notes: error instanceof Error ? error.message : String(error) };
  }
}
