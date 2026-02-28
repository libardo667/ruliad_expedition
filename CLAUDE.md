# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

```bash
# Set environment variables (required)
export OPENROUTER_API_KEY="your_openrouter_api_key"
# Optional - only needed for Wolfram Alpha features
export WOLFRAM_APPID="your_wolfram_appid"

# Start the proxy server
node proxy_server.mjs

# Open http://localhost:8787
```

On Windows/PowerShell use `$env:OPENROUTER_API_KEY="..."` syntax. Restart the server after changing environment variables. The port is configurable via `PORT` env var (default `8787`).

## Architecture

This is a **two-file application** with no build step and no npm dependencies:

- **[proxy_server.mjs](proxy_server.mjs)** — Pure Node.js ESM proxy (~436 lines). No external packages; requires Node v18+.
- **[ruliad_expedition_v1.1.html](ruliad_expedition_v1.1.html)** — Single-file SPA (~6400 lines) with all CSS and JS inline. External CDN deps: Plotly.js 2.27.0 and JSZip 3.10.1.

### Proxy Server Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/llm/chat/completions` | Proxies to OpenRouter chat API |
| `POST` | `/api/llm/embeddings` | Proxies to OpenRouter embeddings API |
| `POST` | `/api/wolfram/query` | Proxies to Wolfram Alpha raw JSON (server-side in-memory cache, default 6h TTL) |
| `POST` | `/api/wolfram/normalize` or `/wa/normalize` | Wolfram normalized response with signal extraction |
| `GET`  | `/*` | Static file serving from CWD |

Auth resolution: uses client `Authorization: Bearer ...` header if present, falls back to `OPENROUTER_API_KEY` env var.

### Frontend Expedition Flow (`launchExpedition` at line 5304)

1. **Probe phase** — parallel LLM calls (one per discipline) using `buildProbeUserPrompt`. Each returns JSON: `{summary, terms[], claims_or_findings[], citations[], confidence_notes}`.
2. **Wolfram grounding** — optional per-term factual grounding via `groundProbeTermsWithWolfram` (requires proxy mode + Wolfram AppID).
3. **Synthesis phase** — second LLM call with all probe results, returns `{convergent[], contradictory[], emergent[]}` via `buildSynthesisPrompt`.
4. **Second-pass cleanup** — optional deduplication pass (rigor quality profile only).
5. **Term building** — `buildTerms()` merges probe + synthesis results into flat `TERMS[]` array.
6. **Semantic positioning** — `assignSemanticPositions()` embeds all terms via the embeddings API then projects to 3D (UMAP-style via inline JS, with stability reruns for consistency). Falls back to deterministic geometry if embeddings fail.
7. **Visualization** — `renderPlot()` creates/updates a Plotly 3D scatter plot.

### Key Global State (all in the `<script>` block)

- `DISCS[]` — Active discipline/probe specs `{id, name, abbr, col, kind}`
- `TERMS[]` — All positioned terms `{label, type, slices[], pos[], citations[], grounding}`
- `CITATIONS[]` — All collected citations from probes
- `LAST_RUN`, `RUN_STATE` — Current run snapshot/state
- `CALL_LOGS[]` — LLM call log (visible in the Calls modal)
- `sessionConfig` — Current API config from the setup form
- `isGenerating` — Guards against concurrent runs

### API Modes

- **Direct mode**: Browser calls `https://openrouter.ai/api/v1/...` directly. Requires non-`file://` origin for CORS. Cannot use Wolfram (browser CORS blocks Wolfram Alpha).
- **Proxy mode**: Browser calls `/api/llm/*` on the local proxy. Required for Wolfram grounding.

### Term Types

- `unique` — appears in exactly one discipline
- `convergent` — shared across 2+ disciplines
- `contradictory` — genuine tension between disciplines
- `emergent` — synthesis insight visible only in integration

### Quality Profiles

| Profile | Terms/probe | Behavior |
|---------|------------|----------|
| `fast` | 6–8 | Low temp, large embed batch |
| `balanced` | 8–10 | Default |
| `rigor` | 10–14 | Low temp, second-pass term cleanup |

### Wolfram Caching (Two-layer)

- **Server-side**: Two in-memory `Map`s (raw + normalized) with TTL/LRU eviction. Configurable via env vars `WOLFRAM_CACHE_TTL_MS`, `WOLFRAM_CACHE_MAX`, etc.
- **Client-side**: `localStorage` with TTL (24h for queries, 12h for per-term cache). Cache key `"ruliad_wolfram_cache"`.

### Prompt Customization

Prompts can be overridden per-run via the "Prompt Workbench" panel. Override keys: `probe_system`, `probe_user`, `synthesis`, `lens_generation`, `artifact_deep_report`, `artifact_claims`, `artifact_outline`, `artifact_red_team`, `artifact_replication`, `artifact_markdown`. Stored in `PROMPT_TEMPLATE_OVERRIDES`.

### Default File Resolution

When `GET /` is requested, the proxy searches for the main HTML in this order:
1. `ruliad_expedition_v1.1.html`
2. `ruliad_expedition_2.23.26.html`
3. `ruliad_expedition.html`
4. `ruliad_expedition copy.html`
5. `index.html`
