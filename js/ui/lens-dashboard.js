// Module: js/ui/lens-dashboard.js
// Dashboard for Parallax Lens mode — text-artifact-first post-run experience.

import { ARTIFACT_STORE, LAST_RUN, TERMS, isGeneratingArtifacts, setIsGeneratingArtifacts } from '../core/state.js';
import { ARTIFACT_DEFS, setArtifactReady, setArtifactBusy } from '../artifacts/artifact-store.js';
import { generateClaimsArtifact, generateDeepReportArtifact, generateOutlineArtifact, generateRedTeamArtifact, generateMarkdownArtifact, copyArtifact, downloadArtifact } from '../artifacts/artifact-generators.js';
import { openArtifactModal, regenerateArtifact } from './artifact-drawer-ui.js';
import { showToast } from './notifications.js';
import { switchMainTab } from './tabs.js';
import { readApiConfig } from '../api/llm.js';

// Which artifacts appear in the dashboard, in order
const HERO_KEYS = ['evidence', 'claims', 'outline', 'deep_report'];
const SECONDARY_KEYS = ['raw_terms', 'red_team', 'markdown'];
const ALL_KEYS = [...HERO_KEYS, ...SECONDARY_KEYS];

/**
 * Render the dashboard after a Lens run completes.
 * Sets topic label and populates the artifact grid.
 */
export function renderDashboard(target) {
  const label = document.getElementById('dashboard-topic-label');
  if (label) label.textContent = target.toUpperCase();
  refreshDashboardArtifacts();
  wireDashboardButtons();
}

/**
 * Rebuild all artifact cards in #dashboard-artifact-grid.
 */
export function refreshDashboardArtifacts() {
  const grid = document.getElementById('dashboard-artifact-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const key of ALL_KEYS) {
    const def = ARTIFACT_DEFS[key];
    if (!def) continue;
    const state = ARTIFACT_STORE[key] || { status: 'not_generated', contentText: '' };
    grid.appendChild(buildDashboardCard(key, def, state));
  }
}

function buildDashboardCard(key, def, state) {
  const card = document.createElement('div');
  card.className = 'dashboard-card';
  card.dataset.artifactKey = key;

  const isHero = HERO_KEYS.includes(key);
  if (isHero) card.classList.add('dashboard-card-hero');

  // Badge
  let badgeClass = 'pending';
  let badgeText = 'pending';
  if (state.status === 'ready') { badgeClass = 'ready'; badgeText = 'ready'; }
  else if (state.status === 'generating') { badgeClass = 'generating'; badgeText = 'generating'; }

  // Preview snippet
  const preview = state.contentText
    ? state.contentText.slice(0, 240) + (state.contentText.length > 240 ? '...' : '')
    : '';

  card.innerHTML = `
    <div class="dashboard-card-header">
      <span class="dashboard-card-name">${def.name.toUpperCase()}</span>
      <span class="dashboard-card-badge ${badgeClass}">${badgeText}</span>
    </div>
    ${preview ? `<div class="dashboard-card-preview">${escapeForHTML(preview)}</div>` : ''}
    <div class="dashboard-card-actions">
      ${state.status === 'ready' ? `
        <button class="mini-btn" data-dash-open="${key}">OPEN</button>
        <button class="mini-btn" data-dash-copy="${key}">COPY</button>
        <button class="mini-btn" data-dash-download="${key}">DOWNLOAD</button>
      ` : ''}
      ${def.kind === 'generated' ? `<button class="mini-btn" data-dash-regen="${key}">${state.status === 'ready' ? 'REGENERATE' : 'GENERATE'}</button>` : ''}
    </div>
  `;

  // Wire card action buttons
  card.querySelectorAll('[data-dash-open]').forEach(btn =>
    btn.addEventListener('click', () => openArtifactModal(key)));
  card.querySelectorAll('[data-dash-copy]').forEach(btn =>
    btn.addEventListener('click', () => copyArtifact(key)));
  card.querySelectorAll('[data-dash-download]').forEach(btn =>
    btn.addEventListener('click', () => downloadArtifact(key)));
  card.querySelectorAll('[data-dash-regen]').forEach(btn =>
    btn.addEventListener('click', () => regenerateArtifact(key, { openAfter: true })));

  return card;
}

function escapeForHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wire the top-bar buttons (EXPLORE IN 3D, NEW RUN).
 * Called once per dashboard render; uses replaceWith to avoid duplicate listeners.
 */
function wireDashboardButtons() {
  const exploreBtn = document.getElementById('dashboard-explore-btn');
  if (exploreBtn) {
    const fresh = exploreBtn.cloneNode(true);
    exploreBtn.replaceWith(fresh);
    fresh.addEventListener('click', launchExploreIn3D);
  }

  const newBtn = document.getElementById('dashboard-new-btn');
  if (newBtn) {
    const fresh = newBtn.cloneNode(true);
    newBtn.replaceWith(fresh);
    fresh.addEventListener('click', async () => {
      const { resetToSetup } = await import('../pipeline/launch-expedition.js');
      resetToSetup();
    });
  }
}

/**
 * Run deferred embedding pipeline, then switch to the plot tab.
 */
async function launchExploreIn3D() {
  if (!LAST_RUN || !TERMS.length) {
    showToast('No run data available. Run an analysis first.');
    return;
  }
  const btn = document.getElementById('dashboard-explore-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'EMBEDDING...'; }

  try {
    const { assignSemanticPositions } = await import('../pipeline/launch-expedition.js');
    const { extractSemanticEdges } = await import('../embedding/semantic-edges.js');
    const { showViz } = await import('../plot/plot-render.js');
    const cfg = readApiConfig();
    const target = LAST_RUN.target || 'Topic';

    await assignSemanticPositions(target, cfg, (msg) => {
      if (btn) btn.textContent = msg.length > 30 ? msg.slice(0, 30) + '...' : msg;
    });

    // Semantic edges (best-effort)
    try {
      const { setSemanticEdges } = await import('../core/state.js');
      const edgeResult = await extractSemanticEdges(target, cfg);
      if (edgeResult && edgeResult.relationships.length > 0) {
        setSemanticEdges(edgeResult);
      }
    } catch (err) {
      console.warn('Semantic edge extraction failed during Explore in 3D:', err);
    }

    showViz(target);
    switchMainTab('plot', { silent: true });
  } catch (err) {
    console.error('Explore in 3D failed:', err);
    showToast('Embedding failed: ' + (err.message || err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'EXPLORE IN 3D'; }
  }
}

// -- Auto-generation of artifacts after a Lens run --

/**
 * Progressively auto-generate text artifacts after a Lens run.
 * Fires claims + outline in parallel, then deep_report.
 */
export async function autoGenerateLensArtifacts(target, cfg) {
  if (isGeneratingArtifacts) return;
  setIsGeneratingArtifacts(true);
  showDashboardProgress(true, 'Generating artifacts...');

  try {
    // Phase 1: claims + outline in parallel
    showDashboardProgress(true, 'Generating claims & outline...');
    markCardGenerating('claims');
    markCardGenerating('outline');

    const [claimsRes, outlineRes] = await Promise.allSettled([
      generateClaimsArtifact(target, cfg),
      generateOutlineArtifact(target, cfg)
    ]);

    if (claimsRes.status === 'fulfilled') {
      setArtifactReady('claims', claimsRes.value);
      const lr = LAST_RUN || {};
      lr.claimsLedger = claimsRes.value.data || [];
    }
    if (outlineRes.status === 'fulfilled') {
      setArtifactReady('outline', outlineRes.value);
      const lr = LAST_RUN || {};
      lr.outline = outlineRes.value.contentText;
    }
    refreshDashboardArtifacts();

    // Phase 2: deep report (benefits from claims context)
    showDashboardProgress(true, 'Generating deep report...');
    markCardGenerating('deep_report');
    try {
      const reportRes = await generateDeepReportArtifact(target, cfg);
      setArtifactReady('deep_report', reportRes);
      const lr = LAST_RUN || {};
      lr.report = reportRes.contentText;
    } catch (err) {
      console.warn('Deep report auto-generation failed:', err);
    }
    refreshDashboardArtifacts();

    showDashboardProgress(false, 'Artifacts ready');
  } catch (err) {
    console.error('Auto-generate lens artifacts failed:', err);
    showToast('Some artifacts failed to generate.');
  } finally {
    setIsGeneratingArtifacts(false);
    showDashboardProgress(false);
    refreshDashboardArtifacts();
  }
}

function markCardGenerating(key) {
  const item = ARTIFACT_STORE[key];
  if (item) item.status = 'generating';
}

function showDashboardProgress(visible, label) {
  const el = document.getElementById('dashboard-artifact-progress');
  const labelEl = document.getElementById('dashboard-artifact-progress-label');
  if (el) el.style.display = visible ? '' : 'none';
  if (labelEl) labelEl.textContent = label || '';
}
