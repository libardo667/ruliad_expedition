## Product Architecture Vision (established Feb 2026)

The app has two primary modes and they are intentional inverses of each other:

**Expedition Mode** (plot-first): Entry → "I have a concept I want to map." Landing page → Expedition Mode → Simple or Advanced disambiguation → run → primary output is the 3D semantic map; text artifacts (claims, outline, deep report, etc.) available on demand via the ARTIFACTS button. The sidebar/plot view is the experience.

**News Lens Mode** (text-first): Entry → "I have a news event I want to understand from multiple angles." Landing page → News Lens → seed URL → FIND STORIES → select sources → run → primary output is an auto-generated text artifact library (claims, evidence comparison, outline, key quotes per perspective) presented upfront as a neat package. The 3D UMAP plot is available as an optional additional step for users who want to explore the semantic topology, but it is NOT the default landing point. The artifact generation runs as part of the pipeline, not as an afterthought requiring manual button clicks.

**Landing page** therefore becomes three clear paths: EXPEDITION MODE | NEWS LENS | LOAD AN EXAMPLE. The SIMPLE/ADVANCED disambiguation lives inside Expedition Mode where it belongs. Both modes share the same underlying probe → synthesis → embedding pipeline; only the entry UX and primary output surface differ.

---

10 Major Things

~~1. Progressive Disclosure UI Overhaul~~
~~DONE. Landing page with three mode cards (SIMPLE / URL RSS MODE / ADVANCED). SIMPLE shows topic + run only. ADVANCED shows full workbench with prompt editor behind a toggle. Mode persists across reloads via sessionStorage.~~

~~2. News/URL Ingestion Mode → News Lens Mode~~
~~DONE. Landing card renamed to NEWS LENS. Sources mode redesigned from paste-box to curated source discovery browser. User selects a perspective lens (Political Spectrum / Geographic / Domain / Custom), enters a topic, clicks FIND STORIES, and the proxy fetches all curated RSS feeds in parallel. Articles are scored per-column by relevance (topic keyword overlap), recency (pubDate age), and cross-coverage (shared headline tokens across other columns). Top 5 per column render as selectable evidence cards; articles ≤50% relevance collapse under a "See less relevant" toggle, and all-irrelevant columns show a persistent opt-in warning rather than silently showing noise. Multi-select per column with a balance bar chart that warns on uneven spread. Cards are expandable (single-click = expand in column, double-click = full modal preview). When USE SELECTED SOURCES is clicked: full article text is fetched per article, then each article is pre-summarized via a parallel LLM call (400–600 word structured summaries: thesis, key facts, verbatim quotes, framing, source URL). Summaries are grouped by column label into `sourceByDisc` so each probe receives only its column's summaries — e.g. {Left:2, Center:1} means the Left probe gets 2 summaries, Center gets 1. The Probe Lenses inputs auto-populate with the column labels and their political-spectrum colors. The sources section locks (dims, pointer-events:none) and the launch button disables during the full fetch+summarize cycle. Prompt "mad libs" dead code (`sanitizePromptMadLib`, `buildPromptMadLibNotes`, `appendPromptMadLibBlock`, and 5 cfg fields that were never wired to HTML inputs) was removed from 7 files. Logic lives in `js/domain/news-sources.js` (feed configs + scoring utils), `js/ui/setup-panel.js` (panel UX + summarization), and `js/pipeline/launch-expedition.js` (per-disc source routing).~~

3. Onboarding Flow
There is zero first-run experience. No explanation of what an "expedition" is, what the four term types mean, what the 3D plot represents, or why any of it matters. Need: a 3-step intro tooltip tour (can be skipped), a plain-English explanation of convergent/emergent/contradictory that appears contextually, and ideally a live demo that runs without any config.

4. "Try It Without an API Key" — Sample Run Loader ⚠️ PARTIAL
The LOAD AN EXAMPLE card is live on the landing page. A `<select>` dropdown lists all 6 runs in `sample_runs/`; clicking LOAD calls `loadSampleRun()` → `fetch('/sample_runs/<file>')` → `hydrateRunFromImport()`. The two new runs (iran_2.28.26, israel_2.28.26) load correctly. The four legacy runs (money, trump_tariffs, truth_and_falsehood, unintelligible_alien) fail to hydrate because they were generated before the Wolfram grounding and mad-libs prompt fields were removed — their schema is incompatible with the current hydration path. Remaining work: either (a) regenerate those sample runs with the current pipeline, or (b) write a legacy schema migration shim in `hydrateRunFromImport` to strip obsolete fields before hydrating.

~~5. Complete the ES Modules Migration~~
~~DONE. All 46 modules are extracted and active. `ruliad_expedition_modular.html` is the entry point served by the proxy by default. The `window.*` compatibility bridge remains by design.~~

5. Hosted Deployment with Server-Side Key Management
Right now this requires: cloning a repo, having Node 18+, setting an env var, running a local server. That's a 5-step technical barrier before a user can see anything. Deploy to Railway/Render/Cloudflare Workers with a server-side key pool (rate-limited per-session). This is the single biggest unlock for reaching users beyond developers.

~~6. Run History~~
~~DONE (minus comparison). Every completed expedition and every imported/sample run is auto-saved to IndexedDB (`ruliad_history` DB, `runs` store, keyed by `runId`). A HISTORY button in the top tab bar opens a drawer listing all saved runs with target, date, term count, citation count, and discipline chips. Per-run actions: LOAD (calls `hydrateRunFromImport` — full state restoration), EXPORT (direct JSON download from the drawer), DELETE. Capped at 50 most recent; oldest auto-pruned on save. `runId` is a deterministic hash so re-importing the same run upserts rather than duplicates. New modules: `js/io/run-history.js` (IndexedDB wrapper), `js/ui/history-drawer-ui.js` (drawer + card renderer). Comparison (side-by-side two runs on same topic) remains as a future enhancement.~~

7. Shareable / Embeddable Results
The JSON export is there but it's a download. Generate a stable URL for any run (either a hash of the data embedded in the URL, or a server-side store). This enables sharing: "here's what the expedition on [topic] found" without the recipient needing any config. It also enables the news use case — journalists sharing expedition snapshots.

8. Result Narrative Mode
The 3D scatter plot is beautiful but it's an expert artifact. Add a "prose synthesis" view — a 3–5 paragraph newspaper-style summary auto-generated from the expedition data. This is the output a non-expert user can actually read and share. The artifact generators already exist for deep reports; this is a lightweight version of that as the primary output. Note: for News Lens Mode (see Architecture Vision above), this narrative becomes the *primary* deliverable, auto-generated and presented upfront at run completion rather than requiring manual button clicks.

9. Surfaced, Actionable Error Handling
Failures currently degrade silently (console.warn, fallback JSON rescue) or leave the UI in an unclear state. A first-time user with a wrong API key, a rate-limited model, or a malformed response gets... nothing useful. Every failure mode needs a visible, plain-English message with a specific action: "Your OpenRouter key was rejected — check it in the setup panel" or "The synthesis step timed out — try the Balanced quality profile."

10. Citation-Driven Evidence Layer
Citation count now drives node color in the plot, but citations themselves are underused. Surface them more: show top sources in the sidebar, let users click a term to see its supporting evidence inline (not just in the modal), and add a "citation quality" filter that hides terms with zero supporting sources. This turns the evidence modal from a power-user feature into a first-class discovery surface. Also add citation provenance tagging: after a run, cross-reference each citation URL against the user's provided source URLs (`cfg.sourceUrls`). Citations that match get `provenance: "provided"`; citations the model retrieved beyond the provided sources get `provenance: "model"`. Display a small indicator ("Your source" vs. "Web-retrieved") in the evidence modal and term sidebar. Broadening via web knowledge is a feature — transparency about which sources were provided vs. model-retrieved is what's missing.


11. Doc Checker Mode (PDF as Source)
A sister mode to News/URL Ingestion but for documents. The user uploads a PDF (a contract, legal filing, policy document, regulatory form, research paper) and the expedition runs against the document's own content rather than the model's training data. The target concept becomes "what claims does this document make" and the probe lenses shift to document-analysis archetypes: Legal Compliance, Logical Consistency, Factual Grounding, Rhetorical Structure, Omission Analysis, Definitional Precision. Each probe reads the extracted document text and returns findings grounded in what the document actually says. The synthesis layer then maps tensions (e.g., a clause that contradicts another), emergent patterns (e.g., a compliance gap implied by the structure), and convergent themes. Unique prompt templates are needed for this mode — probes read document passages rather than querying open knowledge. The resulting map answers: "Is this document internally consistent? Does it make claims it can't support? What's missing?" Practical use cases: compliance review of legal forms, fact-checking of policy white papers, identifying internal contradictions in long contracts, or simply understanding the conceptual structure of a dense document.

~~12. Article-Seeded Expedition — "Perspective Finder" Mode~~
~~DONE. The topic-string entry point for News Lens mode has been replaced with a seed URL input ("Article URL to explore"). Clicking FIND STORIES now: (1) fetches the seed article, (2) runs an LLM call to extract publication date, 5–8 named entities, and a topic label, (3) auto-fills the Focus Concept field with the extracted topic, (4) renders a locked "ANCHOR" card showing date, detected entities, and a note about the ±7-day filter, (5) fetches all RSS feeds and applies `filterByTemporalProximity()` to keep only articles within ±7 days of the seed's pubDate, (6) scores with `scoreArticleWithSeed()` — 60% topic-keyword overlap + 40% named-entity string match (using `.includes()` so proper nouns survive). Graceful degradation: if no API key is configured, metadata extraction is skipped, anchor card shows title + "date unknown", temporal filter is skipped, and scoring falls back to keyword-only. CLEAR resets the seed URL input and removes the anchor card. New exports in `js/domain/news-sources.js`: `filterByTemporalProximity`, `scoreArticleWithSeed`. New internal helpers in `js/ui/setup-panel.js`: `extractSeedMetadata`, `renderAnchorCard`. New CSS in `css/styles.css`: `.seed-url-row`, `.seed-anchor-row`, `.anchor-card`, `.anchor-card-*`.~~


10 Minor Things

1. Model Selector Dropdown
The current <input type="text"> for model name is a footgun — typos, outdated model IDs, no guidance on cost/capability tradeoffs. Replace with a curated dropdown of 6–8 well-tested models (claude-3.5-haiku, gpt-4o-mini, etc.) with speed/quality labels, plus an "Other" escape hatch.

2. Progress Step Indicator
During an expedition you get a spinner, but no sense of "Probe 3 of 6... Running synthesis... Embedding 47 terms..." Users who don't know how many steps there are will abort before it's done. A clear phase display with estimated step count is low-effort, high-trust.

3. Copy Buttons on All Text Outputs
Artifact text (deep reports, claims lists, outlines, markdown) has no copy button. Users are highlighting and Ctrl+C-ing. Every text output box needs a clipboard icon.

4. App Branding/Identity
The product needs a real name, a tagline, and at minimum a favicon and <title> that isn't a filename. This sounds cosmetic but it matters the moment you share a link.

5. Tooltip/Help Text Audit
"rigor," "replication models," "CA probe," "source policy" — these are insider terms. Do a pass replacing or supplementing every cryptic label with plain-English tooltips. The CA probe section especially needs explanation for non-technical users.

6. Keyboard Shortcuts
Ctrl+Enter to run, Tab to cycle between main tabs, / to focus the topic input. The app is keyboard-hostile right now for power users who want to iterate quickly.

7. Mobile-Friendly Term Output
The 3D Plotly chart on a phone is unusable. Add a 2D list/card fallback for terms (grouped by type) that activates at max-width: 700px. The data is there — it just needs a different renderer.

8. Prominent Theme Toggle
The theme code exists but the toggle is buried. Put a sun/moon icon in the top-right. Also add prefers-color-scheme detection so the first load respects system preference.

9. Export Format Expansion
Beyond JSON: CSV export for terms (for people who want to do their own analysis in Excel/Sheets), and a "Copy Markdown summary" that dumps a clean report. The Markdown artifact generator is already there — surface it better.

10. Differentiated Discipline Colors in Lists
Probe discipline colors are used in the 3D plot but often disappear in the list/sidebar views. Consistently apply the discipline color as a left-border or chip tag in every list that shows which disciplines a term appeared in. This makes the multi-discipline origin of each term legible without opening the detail panel.

11. Term Deduplication in Balanced Mode + Synthesis Semantic Attribution
Two related quality fixes. (A) The second-pass term dedup step currently runs only in rigor quality mode. Balanced mode should run a lighter version: a single LLM pass that merges obvious near-synonym labels (e.g., "Military action" / "Joint Military Operations" / "Pre-emptive Attack") without the full cleanup. On politically dense topics this can reduce raw term count by 20–30%, making the 3D plot and sidebar substantially less noisy. (B) The synthesis prompt currently detects convergence via textual label similarity, which causes it to miss semantically identical concepts under different names ("Humanitarian Toll" and "Civilian Casualties" count as two separate things rather than one convergent finding). Improve the synthesis prompt to: canonicalize labels when it detects near-synonym convergence, and explicitly instruct the model to compare terms by what they *mean*, not just whether the text matches. Both changes compound: better label normalization → more accurate synthesis attribution → a cleaner, more trustworthy map.


13. Two-Mode Experience Redesign (landing page + output surfaces)
Implement the architecture vision above. The landing page becomes three distinct entry cards: EXPEDITION MODE, NEWS LENS, LOAD AN EXAMPLE — each linking to a purpose-built experience. Expedition Mode: move SIMPLE/ADVANCED disambiguation inside this path, keep the existing generation workbench and plot view as the primary output. News Lens Mode: after the run completes, the primary output is an auto-generated artifact library (at minimum: claims ledger, evidence per perspective, key quotes per column/discipline, and a narrative synthesis paragraph). The 3D UMAP plot is offered as an optional "EXPLORE IN 3D" step, not the landing point. Artifact auto-generation fires in the pipeline after synthesis, without requiring user interaction. The "GENERATION PANEL" tab label and dual-tab structure may need rethinking — in News Lens the concept of "generation workbench" doesn't apply; the user's job is done after USE SELECTED SOURCES + RUN.

14. Plot View + Sidebar Redesign / Visualization Library Investigation
The current sidebar (320px wide, 9 stacked sections) is visually dense and unreadable as a primary interface. The sidebar is not sacred — other approaches are on the table. Open design questions: (a) Should we replace or supplement Plotly.js? Candidates: Three.js (more control, beautiful custom scenes), D3 force-directed 2D (more legible for most users, easier to click into terms), or a 2D UMAP scatter with D3 (simpler navigation than 3D). (b) **Sidebar is eliminated entirely.** The plot is the full canvas. Three floating overlay panels replace it, all in the same visual style (same card appearance, same X dismiss button): (1) Controls panel — disc toggles, type toggles, color mode, text search; floats over the plot, toggled from the topbar. (2) Term detail panel — updates in-place on each node click, persists until X clicked. (3) Diagnostics panel — embedding matrix, CA panel, corpus stats; power-user, floating, X to close. No sidebar column, no permanent left panel, no layout shift when panels open/close. Panel triggers: `var(--accent)`-colored semicircles on the left edge (controls) and bottom edge (diagnostics), arrow in `var(--accent-fg)` — theme-aware, no hardcoded color needed. On hover near them: translate ~8px toward center + morph from semicircle to full circle (border-radius transition), revert on hover-out. On click: panel slides out with a smooth ease + small spring bounce. Term detail panel has no trigger — opens on node click.

---

The overarching theme of all of these: the intelligence is already there, the codebase already handles the hard problems (fallback JSON recovery, semantic positioning, CA computational irreducibility fingerprinting). What's missing is the layer between that intelligence and a human who just wants to understand something. The major items build that bridge; the minor items polish it.
