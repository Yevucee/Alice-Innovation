export interface RobotsDecision {
  allowed: boolean;
  crawlDelaySec: number | null;
}

interface Group {
  agents: string[];
  rules: Array<{ allow: boolean; path: string }>;
  crawlDelaySec: number | null;
}

function parseGroups(robotsTxt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  const flush = () => {
    if (current && current.agents.length) groups.push(current);
    current = null;
  };
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) {
      flush();
      continue;
    }
    const split = line.indexOf(":");
    if (split < 0) continue;
    const field = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length || current.crawlDelaySec !== null) {
        flush();
        current = { agents: [], rules: [], crawlDelaySec: null };
      }
      current.agents.push(value.toLowerCase());
    } else if (field === "disallow" || field === "allow") {
      if (!current) current = { agents: ["*"], rules: [], crawlDelaySec: null };
      current.rules.push({ allow: field === "allow", path: value });
    } else if (field === "crawl-delay") {
      if (!current) current = { agents: ["*"], rules: [], crawlDelaySec: null };
      const seconds = Number(value);
      if (Number.isFinite(seconds)) current.crawlDelaySec = seconds;
    }
  }
  flush();
  return groups;
}

function matchingGroup(groups: Group[], userAgent: string): Group | null {
  const agent = userAgent.toLowerCase();
  const specific = groups.find((group) =>
    group.agents.some((name) => name !== "*" && agent.includes(name)),
  );
  if (specific) return specific;
  return groups.find((group) => group.agents.includes("*")) ?? null;
}

/** Longest matching Allow wins over an equal or shorter Disallow. Empty Disallow means allow all. */
export function robotsAllows(robotsTxt: string, userAgent: string, path: string): RobotsDecision {
  const group = matchingGroup(parseGroups(robotsTxt), userAgent);
  if (!group) return { allowed: true, crawlDelaySec: null };
  let allowed = true;
  let longest = -1;
  for (const rule of group.rules) {
    if (!rule.path) {
      if (!rule.allow && longest < 0) allowed = true;
      continue;
    }
    if (path.startsWith(rule.path) && rule.path.length >= longest) {
      if (rule.path.length > longest || (rule.path.length === longest && rule.allow)) {
        longest = rule.path.length;
        allowed = rule.allow;
      }
    }
  }
  return { allowed, crawlDelaySec: group.crawlDelaySec };
}
