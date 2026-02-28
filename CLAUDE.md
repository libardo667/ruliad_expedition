# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Brand Identity

The product is being rebranded from "Ruliad Expedition" to **Parallax** — viewing a concept from multiple vantage points to triangulate its true shape. The two modes:
- **Parallax Explore** (formerly "Expedition Mode") — concept-first, plot-primary
- **Parallax Lens** (formerly "News Lens Mode") — article-first, text-primary

The rebrand is in progress. Internal codenames and repo structure still reference the old name. See `majors_and_minors.md` Minor #4 for the full changelist.

## Running the Project

```bash
# Set environment variables (required)
export OPENROUTER_API_KEY="your_openrouter_api_key"

# Start the proxy server
node proxy_server.mjs

# Open http://localhost:8787
```

On Windows/PowerShell use `$env:OPENROUTER_API_KEY="..."` syntax. Restart the server after changing environment variables. The port is configurable via `PORT` env var (default `8787`).

## Architecture

This is a modular application with no build step and no npm dependencies:

- **[proxy_server.mjs](proxy_server.mjs)** — Pure Node.js ESM proxy (~130 lines). No external packages; requires Node v18+.
- **[ruliad_expedition_modular.html](ruliad_expedition_modular.html)** — Entry point that loads CSS and JS modules. External CDN deps: Plotly.js 2.27.0 and JSZip 3.10.1.
- **[js/main.js](js/main.js)** — ES module entry point (imports all modules in dependency order).

### Proxy Server Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/llm/chat/completions` | Proxies to OpenRouter chat API |
| `POST` | `/api/llm/embeddings` | Proxies to OpenRouter embeddings API |
| `GET`  | `/*` | Static file serving from CWD |

Auth resolution: uses client `Authorization: Bearer ...` header if present, falls back to `OPENROUTER_API_KEY` env var.

### Frontend Expedition Flow

1. **Probe phase** — parallel LLM calls (one per discipline) using `buildProbeUserPrompt`. Each returns JSON: `{summary, terms[], claims_or_findings[], citations[], confidence_notes}`. In News Lens mode, each probe receives only its column's pre-summarized article text via `cfg.sourceByDisc[discName]`.
2. **Synthesis phase** — second LLM call with all probe results, returns `{convergent[], contradictory[], emergent[]}` via `buildSynthesisPrompt`.
3. **Second-pass cleanup** — optional deduplication pass (rigor quality profile only).
4. **Term building** — `buildTerms()` merges probe + synthesis results into flat `TERMS[]` array.
5. **Semantic positioning** — `assignSemanticPositions()` embeds all terms via the embeddings API then projects to 3D (UMAP-style via inline JS, with stability reruns for consistency). Falls back to deterministic geometry if embeddings fail.
6. **Semantic edges** — `extractSemanticEdges()` sends all terms to the LLM to identify typed, weighted relationships (analogical, causal, contradictory, complementary, hierarchical, instantiates). On rigor profile, `refinePositionsWithEdges()` runs a force-directed layout to pull related terms closer. Skipped on fast profile. Edges render as colored lines in the 3D plot.
7. **CA probe** — optional computational irreducibility fingerprint derived from run (cellular automata).
8. **Visualization** — `renderPlot()` creates/updates a Plotly 3D scatter plot with semantic edge overlays.

### Key Global State (all in `js/core/state.js`)

- `DISCS[]` — Active discipline/probe specs `{id, name, abbr, col, kind}`
- `TERMS[]` — All positioned terms `{label, type, slices[], pos[], citations[]}`
- `CITATIONS[]` — All collected citations from probes
- `SEMANTIC_EDGES` — LLM-identified relationships between terms `{relationships[], generatedAt, termCount, batchCount}`
- `LAST_RUN`, `RUN_STATE` — Current run snapshot/state
- `CALL_LOGS[]` — LLM call log (visible in the Calls modal)
- `sessionConfig` — Current API config from the setup form
- `isGenerating` — Guards against concurrent runs

### API Modes

- **Direct mode**: Browser calls `https://openrouter.ai/api/v1/...` directly. Requires non-`file://` origin for CORS.
- **Proxy mode**: Browser calls `/api/llm/*` on the local proxy. Recommended for server-side key management.

### Term Types

- `unique` — appears in exactly one discipline
- `convergent` — shared across 2+ disciplines
- `contradictory` — genuine tension between disciplines
- `emergent` — synthesis insight visible only in integration

### Quality Profiles

| Profile | Terms/probe | Behavior |
|---------|------------|----------|
| `fast` | 6–8 | Low temp, large embed batch, no semantic edges |
| `balanced` | 8–10 | Default, semantic edges (no position refinement) |
| `rigor` | 10–14 | Low temp, second-pass term cleanup, semantic edges + force-directed position refinement |

### Prompt Customization

Prompts can be overridden per-run via the "Prompt Workbench" panel. Override keys: `probe_system`, `probe_user`, `synthesis`, `lens_generation`, `artifact_deep_report`, `artifact_claims`, `artifact_outline`, `artifact_red_team`, `artifact_replication`, `artifact_markdown`. Stored in `PROMPT_TEMPLATE_OVERRIDES`. The old "mad libs" prompt fields (`promptIntent`, `promptLensEmphasis`, `promptHardConstraints`, `promptOutputStyle`, `promptArtifactFocus`) were removed — they were never wired to DOM inputs and produced empty strings at runtime.

### News Lens Mode (Sources)

When the user selects NEWS LENS from the landing page, `js/ui/setup-panel.js` drives the panel. The entry point is a seed URL input ("Article URL to explore"), not a topic string.

**Seed-anchored FIND STORIES flow:**
1. User pastes a specific article URL and clicks FIND STORIES
2. `findStories()` fetches the seed article, then calls `extractSeedMetadata()` (LLM) to get `{pubDate, entities[], topicLabel}`
3. Focus Concept field (`#target-input`) is auto-filled with the extracted topic label
4. A locked "ANCHOR" card renders showing date, detected entities, and the ±7-day filter note
5. All RSS feeds are fetched, then filtered by `filterByTemporalProximity(articles, seedDate, 7)` to keep only articles within ±7 days of the seed
6. Articles are scored via `scoreArticleWithSeed()` (60% topic-keyword + 40% named-entity overlap) when entities were extracted, else falls back to `scoreArticle()` keyword-only
7. Graceful degradation: if no API key, metadata extraction is skipped — anchor card shows title + "date unknown", temporal filter is skipped, scoring is keyword-only

**USE SELECTED SOURCES:**
- `useSelectedSources()` fetches full article text, runs parallel LLM pre-summarization per article (400–600 words, `__maxTokens:800`), groups summaries by column label into `SOURCE_MATERIAL.byDisc`, then auto-populates probe disc inputs with column names+colors
- During fetch+summarize: `#launch-btn` is disabled and `sources-loading` CSS class dims the panel

**Probe routing:**
- `js/pipeline/launch-expedition.js` reads `cfg.sourceByDisc[disc.name]` to route per-column summaries to the matching probe

**Key functions in `js/domain/news-sources.js`:** `LENS_CONFIGS`, `tokenize`, `scoreArticle`, `scoreArticleWithSeed`, `parseRecency`, `crossMentionCount`, `parseFeedItems`, `filterByTemporalProximity`

### Default File Resolution

When `GET /` is requested, the proxy searches for the main HTML in this order:
1. `ruliad_expedition_modular.html` ← active entry point
2. `ruliad_expedition_v1.1.html`
3. `ruliad_expedition_2.23.26.html`
4. `ruliad_expedition.html`
5. `ruliad_expedition copy.html`
6. `index.html`

## Product Roadmap

See **[majors_and_minors.md](majors_and_minors.md)** for the prioritized list of planned improvements:

**10 Major items** (significant user-facing features):
Progressive Disclosure UI, News/URL Ingestion, Onboarding Flow, Sample Run Loader, Complete ES Modules Migration, Hosted Deployment, Run History, Shareable Results, Result Narrative Mode, Surfaced Error Handling.

**10 Minor items** (polish and QoL):
Model Selector Dropdown, Progress Step Indicator, Copy Buttons, App Branding, Tooltip Audit, Keyboard Shortcuts, Mobile-Friendly Term Output, Theme Toggle, Export Format Expansion, Differentiated Discipline Colors in Lists.
