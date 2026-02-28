# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
6. **CA probe** — optional computational irreducibility fingerprint derived from run (cellular automata).
7. **Visualization** — `renderPlot()` creates/updates a Plotly 3D scatter plot.

### Key Global State (all in `js/core/state.js`)

- `DISCS[]` — Active discipline/probe specs `{id, name, abbr, col, kind}`
- `TERMS[]` — All positioned terms `{label, type, slices[], pos[], citations[]}`
- `CITATIONS[]` — All collected citations from probes
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
| `fast` | 6–8 | Low temp, large embed batch |
| `balanced` | 8–10 | Default |
| `rigor` | 10–14 | Low temp, second-pass term cleanup |

### Prompt Customization

Prompts can be overridden per-run via the "Prompt Workbench" panel. Override keys: `probe_system`, `probe_user`, `synthesis`, `lens_generation`, `artifact_deep_report`, `artifact_claims`, `artifact_outline`, `artifact_red_team`, `artifact_replication`, `artifact_markdown`. Stored in `PROMPT_TEMPLATE_OVERRIDES`. The old "mad libs" prompt fields (`promptIntent`, `promptLensEmphasis`, `promptHardConstraints`, `promptOutputStyle`, `promptArtifactFocus`) were removed — they were never wired to DOM inputs and produced empty strings at runtime.

### News Lens Mode (Sources)

When the user selects NEWS LENS from the landing page, `js/ui/setup-panel.js` drives the panel:
- `findStories()` — fetches curated RSS feeds via `/api/fetch-url`, scores/ranks articles per column
- `useSelectedSources()` — fetches full article text, runs a parallel LLM pre-summarization call per article (400–600 words), groups summaries by column label into `SOURCE_MATERIAL.byDisc`, then auto-populates probe disc inputs with column names+colors
- During fetch+summarize: `#launch-btn` is disabled and `sources-loading` CSS class dims the panel
- `js/pipeline/launch-expedition.js` reads `cfg.sourceByDisc[disc.name]` to route per-column summaries to the matching probe

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
