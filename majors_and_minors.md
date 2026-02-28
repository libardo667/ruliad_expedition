10 Major Things

~~1. Progressive Disclosure UI Overhaul~~
~~DONE. Landing page with three mode cards (SIMPLE / URL RSS MODE / ADVANCED). SIMPLE shows topic + run only. ADVANCED shows full workbench with prompt editor behind a toggle. Mode persists across reloads via sessionStorage.~~

~~2. News/URL Ingestion Mode → News Lens Mode~~
~~DONE. Landing card renamed to NEWS LENS. Sources mode redesigned from paste-box to curated source discovery browser. User selects a perspective lens (Political Spectrum / Geographic / Domain / Custom), enters a topic, clicks FIND STORIES, and the proxy fetches all curated RSS feeds in parallel. Articles are scored per-column by relevance (topic keyword overlap), recency (pubDate age), and cross-coverage (shared headline tokens across other columns). Top 5 per column render as selectable evidence cards; articles ≤50% relevance collapse under a "See less relevant" toggle, and all-irrelevant columns show a persistent opt-in warning rather than silently showing noise. Multi-select per column with a balance bar chart that warns on uneven spread. Cards are expandable (single-click = expand in column, double-click = full modal preview). When USE SELECTED SOURCES is clicked: full article text is fetched per article, then each article is pre-summarized via a parallel LLM call (400–600 word structured summaries: thesis, key facts, verbatim quotes, framing, source URL). Summaries are grouped by column label into `sourceByDisc` so each probe receives only its column's summaries — e.g. {Left:2, Center:1} means the Left probe gets 2 summaries, Center gets 1. The Probe Lenses inputs auto-populate with the column labels and their political-spectrum colors. The sources section locks (dims, pointer-events:none) and the launch button disables during the full fetch+summarize cycle. Prompt "mad libs" dead code (`sanitizePromptMadLib`, `buildPromptMadLibNotes`, `appendPromptMadLibBlock`, and 5 cfg fields that were never wired to HTML inputs) was removed from 7 files. Logic lives in `js/domain/news-sources.js` (feed configs + scoring utils), `js/ui/setup-panel.js` (panel UX + summarization), and `js/pipeline/launch-expedition.js` (per-disc source routing).~~

3. Onboarding Flow
There is zero first-run experience. No explanation of what an "expedition" is, what the four term types mean, what the 3D plot represents, or why any of it matters. Need: a 3-step intro tooltip tour (can be skipped), a plain-English explanation of convergent/emergent/contradictory that appears contextually, and ideally a live demo that runs without any config.

4. "Try It Without an API Key" — Sample Run Loader
There are 4 sample runs in sample_runs/ (money, trump_tariffs, truth_and_falsehood, unintelligible_alien) but no way to load them from the UI. Until someone has a working OpenRouter key configured, the app is a blank form. A "Load Example" button costs almost nothing to build and makes the tool usable for anyone evaluating it.

~~5. Complete the ES Modules Migration~~
~~DONE. All 46 modules are extracted and active. `ruliad_expedition_modular.html` is the entry point served by the proxy by default. The `window.*` compatibility bridge remains by design.~~

5. Hosted Deployment with Server-Side Key Management
Right now this requires: cloning a repo, having Node 18+, setting an env var, running a local server. That's a 5-step technical barrier before a user can see anything. Deploy to Railway/Render/Cloudflare Workers with a server-side key pool (rate-limited per-session). This is the single biggest unlock for reaching users beyond developers.

6. Run History and Comparison
Currently runs are ephemeral unless you manually export JSON. Auto-save every completed expedition to IndexedDB/localStorage (they're not that large), add a history drawer, let users reload past runs, and eventually compare two runs on the same topic side-by-side. This transforms it from "a tool you run once" to "a tool you return to."

7. Shareable / Embeddable Results
The JSON export is there but it's a download. Generate a stable URL for any run (either a hash of the data embedded in the URL, or a server-side store). This enables sharing: "here's what the expedition on [topic] found" without the recipient needing any config. It also enables the news use case — journalists sharing expedition snapshots.

8. Result Narrative Mode
The 3D scatter plot is beautiful but it's an expert artifact. Add a "prose synthesis" view — a 3–5 paragraph newspaper-style summary auto-generated from the expedition data. This is the output a non-expert user can actually read and share. The artifact generators already exist for deep reports; this is a lightweight version of that as the primary output.

9. Surfaced, Actionable Error Handling
Failures currently degrade silently (console.warn, fallback JSON rescue) or leave the UI in an unclear state. A first-time user with a wrong API key, a rate-limited model, or a malformed response gets... nothing useful. Every failure mode needs a visible, plain-English message with a specific action: "Your OpenRouter key was rejected — check it in the setup panel" or "The synthesis step timed out — try the Balanced quality profile."

10. Citation-Driven Evidence Layer
Citation count now drives node color in the plot, but citations themselves are underused. Surface them more: show top sources in the sidebar, let users click a term to see its supporting evidence inline (not just in the modal), and add a "citation quality" filter that hides terms with zero supporting sources. This turns the evidence modal from a power-user feature into a first-class discovery surface. Also add citation provenance tagging: after a run, cross-reference each citation URL against the user's provided source URLs (`cfg.sourceUrls`). Citations that match get `provenance: "provided"`; citations the model retrieved beyond the provided sources get `provenance: "model"`. Display a small indicator ("Your source" vs. "Web-retrieved") in the evidence modal and term sidebar. Broadening via web knowledge is a feature — transparency about which sources were provided vs. model-retrieved is what's missing.


11. Doc Checker Mode (PDF as Source)
A sister mode to News/URL Ingestion but for documents. The user uploads a PDF (a contract, legal filing, policy document, regulatory form, research paper) and the expedition runs against the document's own content rather than the model's training data. The target concept becomes "what claims does this document make" and the probe lenses shift to document-analysis archetypes: Legal Compliance, Logical Consistency, Factual Grounding, Rhetorical Structure, Omission Analysis, Definitional Precision. Each probe reads the extracted document text and returns findings grounded in what the document actually says. The synthesis layer then maps tensions (e.g., a clause that contradicts another), emergent patterns (e.g., a compliance gap implied by the structure), and convergent themes. Unique prompt templates are needed for this mode — probes read document passages rather than querying open knowledge. The resulting map answers: "Is this document internally consistent? Does it make claims it can't support? What's missing?" Practical use cases: compliance review of legal forms, fact-checking of policy white papers, identifying internal contradictions in long contracts, or simply understanding the conceptual structure of a dense document.

12. Article-Seeded Expedition — "Perspective Finder" Mode
The current News Lens flow asks for an abstract topic string, which causes a critical failure mode: different columns can surface articles from entirely different events or timeframes (e.g., searching "israel" returns a Feb 2026 Iran-strike article and a Jan 2025 Gaza ceasefire article side by side, which the synthesis then treats as contradictory perspectives on the same moment when they aren't). The fix is a better entry point: the user pastes the URL of a specific article they want to understand from multiple angles (or attaches a PDF — connects to item 12). The system fetches and summarizes that seed article, extracts its publication date and key named entities (people, places, organizations, event names), and uses these as the anchor for RSS discovery: articles are filtered to ±7 days of the seed's pubDate, and scored against entity overlap in addition to topic keyword overlap. The seed article appears as a locked "anchor" card at the top of the interface — shown as the common reference point, not selectable as a probe source itself. This single change eliminates cross-temporal contamination, naturally makes the balance-across-lenses requirement meaningful (since all columns are now covering the same event), and shifts the tool's mental model from "I have a topic" to "I read this and want to understand it from every angle." This is the right long-term shape of the News Lens mode.


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


The overarching theme of all of these: the intelligence is already there, the codebase already handles the hard problems (fallback JSON recovery, semantic positioning, CA computational irreducibility fingerprinting). What's missing is the layer between that intelligence and a human who just wants to understand something. The major items build that bridge; the minor items polish it.
