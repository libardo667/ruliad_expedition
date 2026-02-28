// js/main.js — auto-generated entry point
// Import order: core → api → domain → pipeline → embedding → plot → artifacts → ui → io
//
// Modules use named imports/exports throughout; no window.* compatibility layer needed.

import './core/constants.js';
import './core/refs.js';
import './core/state.js';
import './core/utils.js';
import './api/embeddings.js';
import './api/json-recovery.js';
import './api/llm.js';
import './api/provider.js';
import './domain/aliases.js';
import './domain/citations.js';
import './domain/grounding-status.js';
import './domain/run-metadata.js';
import './domain/terms.js';
import './pipeline/launch-expedition.js';
import './pipeline/probes.js';
import './pipeline/reruns.js';
import './pipeline/synthesis.js';
import './embedding/diagnostics.js';
import './embedding/projection.js';
import './embedding/umap-loader.js';
import './embedding/vector-math.js';
import './plot/plot-layout.js';
import './plot/plot-overlays.js';
import './plot/plot-render.js';
import './plot/sidebar.js';
import './plot/term-detail.js';
import './artifacts/artifact-generators.js';
import './artifacts/artifact-store.js';
import './artifacts/exporters.js';
import './ca/automata.js';
import './ca/derive-ca.js';
import './ca/metrics.js';
import './ca/render-ca-panel.js';
import './prompt/prompt-builders.js';
import './prompt/prompt-system.js';
import './io/import-export-run.js';
import './ui/artifact-drawer-ui.js';
import './ui/evidence-modal-ui.js';
import './ui/modals.js';
import './ui/notifications.js';
import './ui/prompt-preview.js';
import './ui/resizers.js';
import './ui/setup-panel.js';
import './ui/tabs.js';
import './ui/theme.js';

// Bootstrap runs as top-level side effects — safe because ES modules defer by default
// (equivalent to <script type="module" defer>), so DOM is ready when this executes.
import './ui/bootstrap.js';
