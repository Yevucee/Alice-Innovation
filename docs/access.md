# Access control (production web)

The Innovation Library web app uses a shared team password (`WEB_AUTH_PASSWORD`) and an httpOnly session cookie. It is not anonymous public data.

Recommended production layers:

1. **Railway networking** — restrict the `alice-web` public hostname to your VPN egress IPs or a corporate proxy where Railway supports it.
2. **Password hygiene** — rotate `WEB_AUTH_PASSWORD` when team membership changes; never commit it or log it.
3. **MCP** — keep `MCP_AUTH_TOKEN` only on MCP clients and server env; the web UI does not expose it to the browser.
4. **Ingestor** — no public domain on `alice-ingestor`.

Springwise article URLs often return 403 to automated clients. The adapter ingests **listing metadata** from the homepage, top-level category pages, and the public RSS feed when those URLs return 200. It does not bypass Cloudflare or paywalls.

Engineering for Change remains **BLOCKED** (Cloudflare bot wall). Legitimate options (not implemented as bypass):

1. Ask EFC/ASME for **API access**, a **data export**, or **crawler allowlisting** for the Railway ingestor egress IPs.
2. Run a one-off ingest from a network that receives HTTP 200, then rely on normal upsert semantics (same adapter, no wall-skipping code).
3. Keep the source disabled until a partner channel exists; the parser and fixtures stay ready.

WIPO GREEN and UpLink are **PAUSED** in the registry: their catalogues are mostly SPA/API-driven. XPRIZE is enabled as a first additional open HTML catalogue (`ingest:production-step4:remote`).
