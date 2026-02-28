10 Major Things
1. Progressive Disclosure UI Overhaul
The setup panel currently fires every knob at the user at once — API key, model, quality, Wolfram AppID, grounding score thresholds, CA params, prompt workbench. A first-time user has no chance. Build a "Simple" mode (topic → Run button) with a collapsible "Advanced" layer. Hide the Wolfram/CA/prompt workbench behind a power-user toggle. The entire configuration surface needs a triage pass.

2. News/URL Ingestion Mode
You said "news digesting tool" but the current app only takes abstract topic strings. The missing half is: paste URLs or an RSS feed, extract claims/entities, run the expedition on that extracted content rather than asking LLMs to synthesize from training data. This is a fundamentally different (and more valuable) mode — grounding the expedition in what's actually being said right now.

3. Onboarding Flow
There is zero first-run experience. No explanation of what an "expedition" is, what the four term types mean, what the 3D plot represents, or why any of it matters. Need: a 3-step intro tooltip tour (can be skipped), a plain-English explanation of convergent/emergent/contradictory that appears contextually, and ideally a live demo that runs without any config.

4. "Try It Without an API Key" — Sample Run Loader
You have 4 great sample runs in sample_runs/ but there's no way to load them from the UI. Until someone has a working OpenRouter key configured, the app is a blank form. A "Load Example: Money / Trump Tariffs / Truth & Falsehood" button in the UI costs almost nothing to build and makes the tool usable for anyone evaluating it.

5. Complete the ES Modules Migration
ruliad_expedition_modular.html exists and the 54-module decomposition is partially done, but you're in a half-way state where the window.* global hack is still holding things together. Finish this — not for its own sake, but because every new feature you add into the current monolith makes it harder to ever get out. The foundation needs to be solid before building upward.

6. Hosted Deployment with Server-Side Key Management
Right now this requires: cloning a repo, having Node 18+, setting an env var, running a local server. That's a 5-step technical barrier before a user can see anything. Deploy to Railway/Render/Cloudflare Workers with a server-side key pool (rate-limited per-session). This is the single biggest unlock for reaching users beyond developers.

7. Run History and Comparison
Currently runs are ephemeral unless you manually export JSON. Auto-save every completed expedition to IndexedDB/localStorage (they're not that large), add a history drawer, let users reload past runs, and eventually compare two runs on the same topic side-by-side. This transforms it from "a tool you run once" to "a tool you return to."

8. Shareable / Embeddable Results
The JSON export is there but it's a download. Generate a stable URL for any run (either a hash of the data embedded in the URL, or a server-side store). This enables sharing: "here's what the expedition on [topic] found" without the recipient needing any config. It also enables the news use case — journalists sharing expedition snapshots.

9. Result Narrative Mode
The 3D scatter plot is beautiful but it's an expert artifact. Add a "prose synthesis" view — a 3–5 paragraph newspaper-style summary auto-generated from the expedition data. This is the output a non-expert user can actually read and share. The artifact generators already exist for deep reports; this is a lightweight version of that as the primary output.

10. Surfaced, Actionable Error Handling
Failures currently degrade silently (console.warn, fallback JSON rescue) or leave the UI in an unclear state. A first-time user with a wrong API key, a rate-limited model, or a malformed response gets... nothing useful. Every failure mode needs a visible, plain-English message with a specific action: "Your OpenRouter key was rejected — check it in the setup panel" or "The synthesis step timed out — try the Balanced quality profile."

10 Minor Things
1. Model Selector Dropdown
The current <input type="text"> for model name is a footgun — typos, outdated model IDs, no guidance on cost/capability tradeoffs. Replace with a curated dropdown of 6–8 well-tested models (claude-3.5-haiku, gpt-4o-mini, etc.) with speed/quality labels, plus an "Other" escape hatch.

2. Progress Step Indicator
During an expedition you get a spinner, but no sense of "Probe 3 of 6... Running synthesis... Embedding 47 terms..." Users who don't know how many steps there are will abort before it's done. A clear phase display with estimated step count is low-effort, high-trust.

3. Copy Buttons on All Text Outputs
Artifact text (deep reports, claims lists, outlines, markdown) has no copy button. Users are highlighting and Ctrl+C-ing. Every text output box needs a clipboard icon.

4. App Branding/Identity
The product is currently named by its file: ruliad_expedition_v1.1.html. It needs a real name, a tagline, and at minimum a favicon and <title> that isn't a filename. This sounds cosmetic but it matters the moment you share a link.

5. Tooltip/Help Text Audit
q_min, a_min, "grounding mode," "rigor," "replication models" — these are insider terms. Do a pass replacing or supplementing every cryptic label with plain-English tooltips. Especially anything in the advanced grounding panel.

6. Keyboard Shortcuts
Ctrl+Enter to run, Tab to cycle between main tabs, / to focus the topic input. The app is keyboard-hostile right now for power users who want to iterate quickly.

7. Mobile-Friendly Term Output
The 3D Plotly chart on a phone is unusable. Add a 2D list/card fallback for terms (grouped by type) that activates at max-width: 700px. The data is there — it just needs a different renderer.

8. Prominent Theme Toggle
The theme code exists but the toggle is buried. Put a sun/moon icon in the top-right. Also add prefers-color-scheme detection so the first load respects system preference.

9. Export Format Expansion
Beyond JSON: a "Download as PNG" button for the 3D chart, CSV export for terms (for people who want to do their own analysis in Excel/Sheets), and a "Copy Markdown summary" that dumps a clean report. The Markdown artifact generator is already there — surface it better.

10. Differentiated Discipline Colors in Lists
Probe discipline colors are used in the 3D plot but often disappear in the list/sidebar views. Consistently apply the discipline color as a left-border or chip tag in every list that shows which disciplines a term appeared in. This makes the multi-discipline origin of each term legible without opening the detail panel.

The overarching theme of all of these: the intelligence is already there, the codebase already handles the hard problems (fallback JSON recovery, semantic positioning, Wolfram grounding, ambiguity queues). What's missing is the layer between that intelligence and a human who just wants to understand something. The major items build that bridge; the minor items polish it.

