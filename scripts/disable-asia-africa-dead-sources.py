#!/usr/bin/env python3
"""Set enabled: false for probed dead Asia/Africa sources (Oct 2026 cron follow-up)."""
from pathlib import Path

REASONS = {
    "accelerating-asia": "Oct 2026 probe: 0 refs (SPA/empty portfolio HTML).",
    "astana-hub-company-network": "Oct 2026 probe: 0 refs at /en/startup (needs API/SPA fix).",
    "astana-hub-startup-programmes": "Oct 2026 probe: 0 refs; duplicate adapter path.",
    "atal-incubation-centres": "Oct 2026 probe: 0 refs (static PHP listing).",
    "birac-bionest": "Oct 2026 probe: 0 refs.",
    "cradle-fund": "Oct 2026 probe: 0 refs.",
    "cradle-seed-ventures": "Oct 2026 probe: 0 refs.",
    "hicool": "Oct 2026 probe: 0 refs.",
    "hkust-innovation": "Oct 2026 probe: 0 refs.",
    "iit-bombay-innovation": "Oct 2026 probe: 0 refs.",
    "iit-kanpur-innovation": "Oct 2026 probe: 0 refs.",
    "iit-madras-innovation": "Oct 2026 probe: fetch failed from ingest egress.",
    "indigo-indonesia": "Oct 2026 probe: 0 refs.",
    "insignia-ventures-partners": "Oct 2026 probe: 0 refs (VC page / JS).",
    "ipi-singapore-innovation-marketplace": "Oct 2026 probe: 0 refs.",
    "iterative-demo-day": "Oct 2026 probe: 0 refs.",
    "kaust-entrepreneurial-spinouts": "Oct 2026 probe: 0 refs.",
    "kaust-innovation-ventures": "Oct 2026 probe: 0 refs.",
    "kaust-scalex-portfolio": "Oct 2026 probe: 0 refs.",
    "kaust-taqadam": "Oct 2026 probe: 0 refs.",
    "mystartup-malaysia": "Oct 2026 probe: fetch failed from ingest egress.",
    "mystartup-startup-directory": "Oct 2026 probe: fetch failed from ingest egress.",
    "national-startup-awards-india": "Oct 2026 probe: Wayback 404; no live catalogue.",
    "ntu-innovation": "Oct 2026 probe: HTTP 404 portfolio URL.",
    "ntuitive": "Oct 2026 probe: HTTP 404 portfolio URL.",
    "seoul-bio-hub": "Oct 2026 probe: fetch failed from ingest egress.",
    "seoul-startup-plus": "Oct 2026 probe: fetch failed from ingest egress.",
    "startup-bangladesh": "Oct 2026 probe: 0 refs; robots disallow on portfolio.",
    "startup-india-showcase": "Oct 2026 probe: Wayback 404.",
    "baobab-network": "Oct 2026 probe: 0 refs (JS portfolio; see PR #85 Vite bundle discover).",
}

path = Path("config/sources.yaml")
lines = path.read_text().splitlines()
out: list[str] = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("  - id:"):
        slug = line.split(":", 1)[1].strip()
        out.append(line)
        i += 1
        while i < len(lines) and not lines[i].startswith("  - id:"):
            if slug in REASONS and lines[i].strip() == "enabled: true":
                out.append(f"    # DISABLED: {REASONS[slug]}")
                out.append("    enabled: false")
            else:
                out.append(lines[i])
            i += 1
        continue
    out.append(line)
    i += 1

path.write_text("\n".join(out) + "\n")
print(f"disabled {len(REASONS)} sources")
