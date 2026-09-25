# Access control (production web)

The Innovation Library web app uses a shared team password (`WEB_AUTH_PASSWORD`) and an httpOnly session cookie. It is not anonymous public data.

Recommended production layers:

1. **Railway networking** — restrict the `alice-web` public hostname to your VPN egress IPs or a corporate proxy where Railway supports it.
2. **Password hygiene** — rotate `WEB_AUTH_PASSWORD` when team membership changes; never commit it or log it.
3. **MCP** — keep `MCP_AUTH_TOKEN` only on MCP clients and server env; the web UI does not expose it to the browser.
4. **Ingestor** — no public domain on `alice-ingestor`.

Springwise article URLs often return 403 to automated clients; the adapter only ingests public homepage tiles unless access improves.

Engineering for Change remains **BLOCKED** (bot wall); do not bypass Cloudflare.
