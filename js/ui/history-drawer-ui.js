import { loadRunHistory, deleteRunFromHistory, getRunFromHistory } from '../io/run-history.js';
import { hydrateRunFromImport } from '../io/import-export-run.js';
import { showToast } from './notifications.js';

export function setHistoryDrawer(open) {
  const el = document.getElementById("history-drawer");
  if (!el) return;
  el.classList.toggle("open", Boolean(open));
  if (open) refreshHistoryList();
}

export function toggleHistoryDrawer() {
  setHistoryDrawer(!document.getElementById("history-drawer")?.classList.contains("open"));
}

export async function refreshHistoryList() {
  const list = document.getElementById("history-list");
  if (!list) return;
  list.innerHTML = '<div class="history-empty">Loading…</div>';
  try {
    const runs = await loadRunHistory();
    list.innerHTML = "";
    if (!runs.length) {
      list.innerHTML = '<div class="history-empty">No saved runs yet. Complete a run to auto-save it here.</div>';
      return;
    }
    for (const run of runs) list.appendChild(makeHistoryCard(run));
  } catch (err) {
    list.innerHTML = `<div class="history-empty">Could not load history: ${escHtml(err.message)}</div>`;
  }
}

function makeHistoryCard(run) {
  const card = document.createElement("div");
  card.className = "history-run-card";
  const date = run.savedAt
    ? new Date(run.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "unknown date";
  const termCount = Array.isArray(run.terms) ? run.terms.length : "?";
  const citCount = Array.isArray(run.citations) ? run.citations.length : 0;
  const llmDiscs = (run.discs || []).filter(d => d.kind !== "ca");
  const discChips = llmDiscs.slice(0, 5)
    .map(d => `<span class="history-disc-chip" style="border-color:${escHtml(d.col)};color:${escHtml(d.col)}">${escHtml(d.abbr || d.name)}</span>`)
    .join("");
  card.innerHTML = `
    <div class="history-card-top">
      <div class="history-card-target">${escHtml(run.target || "(untitled)")}</div>
      <div class="history-card-meta">${escHtml(date)} · ${termCount} terms · ${citCount} citations</div>
      <div class="history-card-discs">${discChips}</div>
    </div>
    <div class="history-card-actions">
      <button class="small-btn" data-action="load">LOAD</button>
      <button class="small-btn" data-action="export">EXPORT</button>
      <button class="small-btn" data-action="delete">DELETE</button>
    </div>`;
  card.querySelector('[data-action="load"]').addEventListener("click", async () => {
    try {
      const full = await getRunFromHistory(run.runId);
      if (!full) throw new Error("Run not found.");
      hydrateRunFromImport(full);
      setHistoryDrawer(false);
    } catch (err) { showToast(`Load failed: ${err.message}`); }
  });
  card.querySelector('[data-action="export"]').addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `parallax-run-${(run.target || "run").replace(/\s+/g, "-").slice(0, 30)}-${date.replace(/[\s,]/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    await deleteRunFromHistory(run.runId);
    card.remove();
    const list = document.getElementById("history-list");
    if (list && !list.querySelector(".history-run-card")) {
      list.innerHTML = '<div class="history-empty">No saved runs yet.</div>';
    }
  });
  return card;
}

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
