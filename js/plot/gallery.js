// Gallery mode — 2D quipu/circuit diagram view of semantic neighborhoods.
// Each strand is a BFS-connected component from SEMANTIC_EDGES, rendered as
// an SVG overlay with vertical cords, node knots, and circuit-trace edges.

import { SEMANTIC_EDGES, TERMS, DISCS, galleryActive, setGalleryActive, setSemanticEdges, activeSlices, activeTypes, sessionConfig } from '../core/state.js';
import { TYPE_CFG } from '../core/constants.js';
import { playShutterTransition } from '../ui/shutter-transition.js';
import { showTermDetail } from './term-detail.js';
import { getVisibleNodeTerms } from './sidebar.js';
import { extractSemanticEdges } from '../embedding/semantic-edges.js';

// ── Edge type colors (mirrored from plot-overlays.js / term-detail.js) ──
const EDGE_TYPE_COLORS = {
  analogical: '#3b82f6', causal: '#22c55e', contradictory: '#ff9500',
  complementary: '#a855f7', hierarchical: '#6b7280', instantiates: '#00cfff'
};

// ── Node shape helpers ──
const NODE_RADIUS = 10;
const RING_SPACING = 100;
const CORD_X_CENTER = 0; // relative; actual center computed from container

// ── Internal state ──
let _strands = [];
let _currentStrandIdx = 0;
let _svgEl = null;
let _focusedNodeIdx = -1;
let _keyHandler = null;

// ── Public API ──

export function isGalleryActive() { return galleryActive; }

let _entering = false;
export function toggleGallery() {
  if (galleryActive) return exitGallery();
  if (_entering) return; // guard against double-click during async edge computation
  _entering = true;
  enterGallery().finally(() => { _entering = false; });
}

export function disposeGallery() {
  if (_svgEl) { _svgEl.remove(); _svgEl = null; }
  document.querySelector('.gallery-strand-info')?.remove();
  document.querySelector('.gallery-nav-hint')?.remove();
  document.querySelector('.gallery-info-panel')?.remove();
  _strands = [];
  _currentStrandIdx = 0;
  _focusedNodeIdx = -1;
  if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
  const plotEl = document.getElementById('plot');
  if (plotEl) plotEl.style.display = '';
  setGalleryActive(false);
  document.body.classList.remove('gallery-active');
}

export function galleryScrollToNode(label) {
  if (!galleryActive || !_svgEl) return;
  const strand = _strands[_currentStrandIdx];
  if (!strand) return;
  const idx = strand.nodes.findIndex(n => n.term.label.toLowerCase() === label.toLowerCase());
  if (idx >= 0) {
    _focusedNodeIdx = idx;
    highlightFocusedNode();
    showTermDetail(strand.nodes[idx].term);
  }
}

export function applyGalleryFilters() {
  if (!galleryActive) return;
  // Recompute strands with current filters, re-render current strand
  const visibleTerms = getVisibleNodeTerms();
  _strands = findNeighborhoods(visibleTerms);
  if (_currentStrandIdx >= _strands.length) _currentStrandIdx = Math.max(0, _strands.length - 1);
  if (_strands.length) renderStrand(_currentStrandIdx);
  else clearSVG();
}

// ── Enter / Exit ──

async function enterGallery() {
  const visibleTerms = getVisibleNodeTerms();
  if (!visibleTerms.length) return;

  // If no semantic edges exist but we have enough terms, compute them on demand
  if (!SEMANTIC_EDGES?.relationships?.length && TERMS.length >= 4 && sessionConfig) {
    // Show a visible loading state while the LLM analyzes relationships
    const vignette = document.getElementById('plot-vignette');
    const span = vignette?.querySelector('.shutter-msg');
    if (vignette) vignette.classList.add('shutter-active');
    if (span) span.textContent = 'analyzing semantic relationships...';

    try {
      const target = document.getElementById('target-input')?.value || '';
      const quality = { id: 'balanced' };
      const edgeResult = await extractSemanticEdges(target, sessionConfig, quality);
      if (edgeResult?.relationships?.length) {
        setSemanticEdges(edgeResult);
      }
    } catch (err) {
      console.warn('[gallery] on-demand semantic edge extraction failed:', err);
    }

    // Clear loading state — the enterGallery shutter below will take over
    if (vignette) vignette.classList.remove('shutter-active');
    if (span) span.textContent = '';
  }

  _strands = findNeighborhoods(visibleTerms);
  if (!_strands.length) return;

  _currentStrandIdx = 0;
  setGalleryActive(true);
  document.body.classList.add('gallery-active');

  playShutterTransition({
    message: 'entering gallery...',
    onMidpoint: () => {
      // Hide Plotly chart
      const plotEl = document.getElementById('plot');
      if (plotEl) plotEl.style.display = 'none';
      ensureSVG();
      // Defer render by one frame so layout resolves after hiding #plot
      requestAnimationFrame(() => renderStrand(0));
    }
  });

  attachKeyboardNav();
}

function exitGallery() {
  playShutterTransition({
    message: 'returning to plot...',
    onMidpoint: () => {
      if (_svgEl) { _svgEl.remove(); _svgEl = null; }
      document.querySelector('.gallery-strand-info')?.remove();
      document.querySelector('.gallery-nav-hint')?.remove();
      document.querySelector('.gallery-info-panel')?.remove();
      const plotEl = document.getElementById('plot');
      if (plotEl) plotEl.style.display = '';
      setGalleryActive(false);
      document.body.classList.remove('gallery-active');
      // Resize Plotly after re-show
      try { Plotly.Plots.resize(document.getElementById('plot')); } catch {}
    }
  });

  if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
}

// ── Neighborhood detection ──

function findNeighborhoods(visibleTerms) {
  const pool = Array.isArray(visibleTerms) ? visibleTerms : [];
  if (!pool.length) return [];

  const labelMap = new Map();
  for (const t of pool) labelMap.set(t.label.toLowerCase(), t);

  // Start with semantic-edge connected components
  const strands = [];
  const claimed = new Set(); // labels already in a semantic strand

  if (SEMANTIC_EDGES?.relationships?.length) {
    const semantic = findSemanticNeighborhoods(pool);
    for (const s of semantic) {
      strands.push(s);
      for (const n of s.nodes) claimed.add(n.label);
    }
  }

  // Add remaining unclaimed terms grouped by discipline
  const remaining = pool.filter(t => !claimed.has(t.label.toLowerCase()));
  if (remaining.length >= 2) {
    const discStrands = findDisciplineNeighborhoods(remaining);
    strands.push(...discStrands);
  }

  if (!strands.length) {
    // Nothing from semantic or discipline — just show all as one strand
    return findDisciplineNeighborhoods(pool);
  }

  return strands;
}

// Collect semantic edges whose both endpoints are in the given label set
function collectEdgesForLabels(labelSet) {
  if (!SEMANTIC_EDGES?.relationships?.length) return [];
  const edges = [];
  const seen = new Set();
  for (const rel of SEMANTIC_EDGES.relationships) {
    const a = rel.term_a.toLowerCase();
    const b = rel.term_b.toLowerCase();
    if (!labelSet.has(a) || !labelSet.has(b)) continue;
    const key = [a, b].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ key, rel });
  }
  return edges;
}

function findSemanticNeighborhoods(pool) {
  const labelMap = new Map();
  for (const t of pool) labelMap.set(t.label.toLowerCase(), t);

  // Build adjacency list
  const adj = new Map();
  for (const rel of SEMANTIC_EDGES.relationships) {
    const a = rel.term_a.toLowerCase();
    const b = rel.term_b.toLowerCase();
    if (!labelMap.has(a) || !labelMap.has(b)) continue;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ neighbor: b, rel });
    adj.get(b).push({ neighbor: a, rel });
  }

  // BFS connected components
  const visited = new Set();
  const components = [];

  for (const [label] of adj) {
    if (visited.has(label)) continue;
    const component = [];
    const edges = [];
    const queue = [label];
    visited.add(label);

    while (queue.length) {
      const cur = queue.shift();
      component.push(cur);
      for (const { neighbor, rel } of (adj.get(cur) || [])) {
        // Track edge (deduplicate by sorting labels)
        const edgeKey = [rel.term_a.toLowerCase(), rel.term_b.toLowerCase()].sort().join('|');
        if (!edges.find(e => e.key === edgeKey)) {
          edges.push({ key: edgeKey, rel });
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= 2) {
      components.push({ labels: component, edges });
    }
  }

  // Add isolated nodes (not in any semantic edge) as single-node strands if they are part of the visible pool
  // but skip them to keep gallery meaningful — only show connected components

  // Sort components: largest first
  components.sort((a, b) => b.labels.length - a.labels.length);

  // Convert to strand format with BFS layout
  return components.map(comp => buildStrand(comp, labelMap));
}

function findDisciplineNeighborhoods(pool) {
  // Group terms by their primary discipline
  const groups = new Map();
  for (const t of pool) {
    const disc = t.slices[0] ?? -1;
    if (!groups.has(disc)) groups.set(disc, []);
    groups.get(disc).push(t);
  }

  const labelMap = new Map();
  for (const t of pool) labelMap.set(t.label.toLowerCase(), t);

  const strands = [];
  for (const [discId, terms] of groups) {
    if (terms.length < 2) continue;
    const labels = terms.map(t => t.label.toLowerCase());
    // Overlay any semantic edges that exist between terms in this group
    const labelSet = new Set(labels);
    const edges = collectEdgesForLabels(labelSet);
    strands.push(buildStrand({ labels, edges }, labelMap, discId));
  }

  strands.sort((a, b) => b.nodes.length - a.nodes.length);
  return strands;
}

// ── Strand building (BFS layout) ──

function buildStrand(component, labelMap, discId = null) {
  const { labels, edges } = component;

  // Build adjacency for BFS depth
  const adj = new Map();
  for (const l of labels) adj.set(l, []);
  for (const { rel } of edges) {
    const a = rel.term_a.toLowerCase();
    const b = rel.term_b.toLowerCase();
    if (adj.has(a) && adj.has(b)) {
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
  }

  // Pick anchor: node with highest centrality or most connections
  let anchor = labels[0];
  let maxScore = -1;
  for (const l of labels) {
    const term = labelMap.get(l);
    const degree = adj.get(l)?.length || 0;
    const score = (term?.centrality || 0) * 0.4 + degree * 0.6;
    if (score > maxScore) { maxScore = score; anchor = l; }
  }

  // BFS from anchor to assign depth
  const depth = new Map();
  const bfsQueue = [anchor];
  depth.set(anchor, 0);
  const bfsOrder = [];

  while (bfsQueue.length) {
    const cur = bfsQueue.shift();
    bfsOrder.push(cur);
    const d = depth.get(cur);
    for (const nb of (adj.get(cur) || [])) {
      if (!depth.has(nb)) {
        depth.set(nb, d + 1);
        bfsQueue.push(nb);
      }
    }
  }

  // Handle nodes not reached by BFS (disconnected within component — shouldn't happen but safety)
  for (const l of labels) {
    if (!depth.has(l)) {
      depth.set(l, (Math.max(...depth.values()) || 0) + 1);
      bfsOrder.push(l);
    }
  }

  // Group nodes by depth for horizontal spread
  const byDepth = new Map();
  for (const l of bfsOrder) {
    const d = depth.get(l);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(l);
  }

  // Assign radial positions — anchor at center, each depth on a concentric ring
  // Use golden angle (137.508°) to spread nodes evenly across the full circle,
  // regardless of how many nodes are at each depth level.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.399 rad ≈ 137.5°
  const nodes = [];
  let globalIdx = 0; // running index across all non-anchor nodes
  for (const l of bfsOrder) {
    const d = depth.get(l);
    const row = byDepth.get(d);
    const idxInRow = row.indexOf(l);

    if (d === 0) {
      nodes.push({ label: l, term: labelMap.get(l), depth: d, x: 0, y: 0, idxInRow: 0, rowSize: 1 });
    } else {
      const radius = d * RING_SPACING;
      const count = row.length;
      // For rings with many nodes, spread evenly; for sparse rings, use golden angle
      let angle;
      if (count >= 3) {
        // Enough nodes to fill the ring — distribute evenly with a per-ring offset
        const ringOffset = d * GOLDEN_ANGLE;
        angle = ringOffset + (2 * Math.PI * idxInRow) / count;
      } else {
        // 1-2 nodes: use global golden angle sequence so they don't stack
        angle = globalIdx * GOLDEN_ANGLE;
      }
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      nodes.push({ label: l, term: labelMap.get(l), depth: d, x, y, idxInRow, rowSize: count });
      globalIdx++;
    }
  }

  // Disc info for labeling
  const disc = discId != null ? DISCS[discId] : null;
  const anchorTerm = labelMap.get(anchor);

  return {
    nodes,
    edges: edges.map(e => e.rel),
    anchor,
    anchorTerm,
    disc,
    discId
  };
}

// ── SVG rendering ──

function ensureSVG() {
  if (_svgEl) return;
  const wrap = document.getElementById('plot-wrap');
  if (!wrap) return;
  _svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _svgEl.classList.add('gallery-svg');
  _svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  wrap.appendChild(_svgEl);
}

function clearSVG() {
  if (!_svgEl) return;
  _svgEl.innerHTML = '';
}

function renderStrand(index) {
  _currentStrandIdx = index;
  _focusedNodeIdx = 0;
  const strand = _strands[index];
  if (!strand || !_svgEl) return;

  clearSVG();

  // Get dimensions from parent container chain — the SVG itself may report 0 if layout hasn't resolved
  const wrap = document.getElementById('plot-wrap');
  const vizBody = document.getElementById('viz-body');
  const containerRect = _svgEl.getBoundingClientRect();
  const wrapRect = wrap?.getBoundingClientRect();
  const vizBodyRect = vizBody?.getBoundingClientRect();
  const W = containerRect.width || wrapRect?.width || vizBodyRect?.width || 800;
  const H = containerRect.height || wrapRect?.height || vizBodyRect?.height || 600;

  // Set explicit viewBox so content renders even if CSS sizing hasn't resolved
  _svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const PADDING_TOP = 60;
  const PADDING_BOTTOM = 50;

  // Compute bounding box of nodes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of strand.nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }

  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;

  // Scale to fit
  const availW = W - 200; // leave margin for labels
  const availH = H - PADDING_TOP - PADDING_BOTTOM;
  const scale = Math.min(availW / contentW, availH / contentH, 1.5);

  const offsetX = W / 2;
  const scaledH = contentH * scale;
  const offsetY = PADDING_TOP + (availH - scaledH) / 2;

  function tx(x) { return offsetX + (x - (minX + maxX) / 2) * scale; }
  function ty(y) { return offsetY + (y - minY) * scale; }

  // Set viewBox
  _svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // ── Draw concentric ring guides + radial spokes ──
  const anchorNode = strand.nodes.find(n => n.label === strand.anchor);
  if (anchorNode) {
    const cx = tx(anchorNode.x);
    const cy = ty(anchorNode.y);

    // Concentric rings at each depth level (subtle, near-invisible guides)
    const maxDepth = Math.max(...strand.nodes.map(n => n.depth));
    for (let d = 1; d <= maxDepth; d++) {
      const r = d * RING_SPACING * scale;
      _svgEl.appendChild(svgEl('circle', {
        cx, cy, r,
        fill: 'none',
        class: 'gallery-cord',
        'stroke-opacity': '0.08'
      }));
    }

    // Radial spokes from center to each node
    for (const n of strand.nodes) {
      if (n.depth === 0) continue;
      _svgEl.appendChild(svgEl('line', {
        x1: cx, y1: cy,
        x2: tx(n.x), y2: ty(n.y),
        class: 'gallery-branch'
      }));
    }
  }

  // ── Draw edges as circuit traces ──
  for (const rel of strand.edges) {
    const nodeA = strand.nodes.find(n => n.label === rel.term_a.toLowerCase());
    const nodeB = strand.nodes.find(n => n.label === rel.term_b.toLowerCase());
    if (!nodeA || !nodeB) continue;

    const color = EDGE_TYPE_COLORS[rel.type] || '#888';
    const ax = tx(nodeA.x), ay = ty(nodeA.y);
    const bx = tx(nodeB.x), by = ty(nodeB.y);

    // Curved edge routing — arc away from center for readability
    let pathD;
    const anchorCx = anchorNode ? tx(anchorNode.x) : ax;
    const anchorCy = anchorNode ? ty(anchorNode.y) : ay;
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    const dx = midX - anchorCx;
    const dy = midY - anchorCy;
    const dist = Math.hypot(dx, dy) || 1;
    // Push control point outward from center; more push for same-depth edges
    const samering = nodeA.depth === nodeB.depth;
    const push = (samering ? 30 : 15) * scale;
    const ctrlX = midX + (dx / dist) * push;
    const ctrlY = midY + (dy / dist) * push;
    pathD = `M ${ax} ${ay} Q ${ctrlX} ${ctrlY} ${bx} ${by}`;

    const edge = svgEl('path', {
      d: pathD,
      stroke: color,
      'stroke-opacity': '0.55',
      class: 'gallery-edge'
    });
    _svgEl.appendChild(edge);

    // Edge type label at midpoint
    const midLabelX = (ax + bx) / 2;
    const midLabelY = (ay + by) / 2 - 6;
    const edgeLabel = svgEl('text', {
      x: midLabelX, y: midLabelY,
      class: 'gallery-edge-label',
      fill: color,
      'text-anchor': 'middle'
    });
    edgeLabel.textContent = rel.type;
    _svgEl.appendChild(edgeLabel);
  }

  // ── Edge type legend — collected for HTML overlay panel ──
  const usedTypes = new Set(strand.edges.map(r => r.type));

  // ── Draw nodes ──
  const nodeGroups = [];
  for (let i = 0; i < strand.nodes.length; i++) {
    const n = strand.nodes[i];
    const cx = tx(n.x), cy = ty(n.y);
    const term = n.term;
    if (!term) continue;

    const g = svgEl('g', {
      class: 'gallery-node',
      'data-idx': i,
      transform: `translate(${cx}, ${cy})`
    });

    // Node shape based on type
    const typeCol = getNodeColor(term);
    const shape = drawNodeShape(term.type, typeCol, n.label === strand.anchor);
    g.appendChild(shape);

    // Label — positioned radially outward from center
    const angle = Math.atan2(n.y, n.x);
    const isLeftHalf = Math.abs(angle) > Math.PI / 2;
    const labelSide = (n.depth === 0) ? 1 : (isLeftHalf ? -1 : 1);
    const labelX = labelSide * (NODE_RADIUS + 8);
    const anchor = labelSide > 0 ? 'start' : 'end';
    const labelText = svgEl('text', {
      x: labelX, y: 4,
      class: 'gallery-label',
      'text-anchor': anchor,
      visibility: 'hidden'
    });
    labelText.textContent = term.label;
    g.appendChild(labelText);

    // Click handler
    g.addEventListener('click', () => {
      _focusedNodeIdx = i;
      highlightFocusedNode();
      showTermDetail(term);
    });

    _svgEl.appendChild(g);
    nodeGroups.push(g);
  }

  // ── Strand info overlay ──
  const infoDiv = document.createElement('div');
  infoDiv.className = 'gallery-strand-info';
  const anchorLabel = strand.anchorTerm?.label || strand.anchor;
  const strandType = strand.edges.length ? 'semantic neighborhood' : (strand.disc ? strand.disc.name : 'group');
  const edgeInfo = strand.edges.length ? ` · ${strand.edges.length} edges` : '';
  infoDiv.textContent = `strand ${index + 1} of ${_strands.length} — ${strandType} — anchor: ${anchorLabel} — ${strand.nodes.length} terms${edgeInfo}`;
  const existing = document.querySelector('.gallery-strand-info');
  if (existing) existing.remove();
  document.getElementById('plot-wrap')?.appendChild(infoDiv);

  // ── Bottom-right control panel (legend + nav hint) ──
  document.querySelector('.gallery-nav-hint')?.remove();
  document.querySelector('.gallery-info-panel')?.remove();
  const infoPanel = document.createElement('div');
  infoPanel.className = 'gallery-info-panel';

  // Edge type legend
  if (usedTypes.size) {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'gallery-legend';
    for (const type of usedTypes) {
      const color = EDGE_TYPE_COLORS[type] || '#888';
      const row = document.createElement('div');
      row.className = 'gallery-legend-row';
      row.innerHTML = `<span class="gallery-legend-line" style="background:${color}"></span><span class="gallery-legend-label" style="color:${color}">${type}</span>`;
      legendDiv.appendChild(row);
    }
    infoPanel.appendChild(legendDiv);
  }

  // Nav hint
  const navDiv = document.createElement('div');
  navDiv.className = 'gallery-nav-keys';
  navDiv.textContent = '← → strands · ↑ ↓ nodes · esc exit';
  infoPanel.appendChild(navDiv);

  document.getElementById('plot-wrap')?.appendChild(infoPanel);

  // Highlight first node
  highlightFocusedNode();
}

function getNodeColor(term) {
  if (!term) return '#888';
  // Use discipline color for unique terms, type color otherwise
  if (term.type === 'unique' && term.slices.length && DISCS[term.slices[0]]) {
    return DISCS[term.slices[0]].col;
  }
  return TYPE_CFG[term.type]?.col || '#888';
}

function drawNodeShape(type, color, isAnchor) {
  const r = isAnchor ? NODE_RADIUS + 4 : NODE_RADIUS;

  switch (type) {
    case 'convergent': {
      // Diamond
      const d = r * 0.9;
      return svgEl('polygon', {
        points: `0,${-d} ${d},0 0,${d} ${-d},0`,
        fill: color,
        'fill-opacity': '0.85',
        stroke: isAnchor ? '#fff' : color,
        'stroke-width': isAnchor ? 2.5 : 1,
        'stroke-opacity': isAnchor ? '0.9' : '0.5'
      });
    }
    case 'contradictory': {
      // Cross / X mark
      const g = svgEl('g', {});
      const s = r * 0.7;
      g.appendChild(svgEl('line', {
        x1: -s, y1: -s, x2: s, y2: s,
        stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round'
      }));
      g.appendChild(svgEl('line', {
        x1: s, y1: -s, x2: -s, y2: s,
        stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round'
      }));
      if (isAnchor) {
        g.appendChild(svgEl('circle', {
          cx: 0, cy: 0, r: r,
          fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-opacity': '0.6'
        }));
      }
      return g;
    }
    case 'emergent': {
      // Open circle (ring)
      return svgEl('circle', {
        cx: 0, cy: 0, r,
        fill: 'none',
        stroke: color,
        'stroke-width': isAnchor ? 3.5 : 2.5,
        'stroke-opacity': '1'
      });
    }
    default: {
      // Unique: filled circle
      return svgEl('circle', {
        cx: 0, cy: 0, r,
        fill: color,
        'fill-opacity': '0.85',
        stroke: isAnchor ? '#fff' : color,
        'stroke-width': isAnchor ? 2.5 : 1,
        'stroke-opacity': isAnchor ? '0.9' : '0.4'
      });
    }
  }
}

function highlightFocusedNode() {
  if (!_svgEl) return;
  _svgEl.querySelectorAll('.gallery-node').forEach((g, i) => {
    const isFocused = i === _focusedNodeIdx;
    g.classList.toggle('focused', isFocused);
    const label = g.querySelector('.gallery-label');
    if (label) label.setAttribute('visibility', isFocused ? 'visible' : 'hidden');
  });
}

// ── SVG element helper ──

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

// ── Keyboard navigation ──

function attachKeyboardNav() {
  if (_keyHandler) document.removeEventListener('keydown', _keyHandler);

  _keyHandler = (e) => {
    if (!galleryActive) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        exitGallery();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (_strands.length > 1) {
          const prev = (_currentStrandIdx - 1 + _strands.length) % _strands.length;
          playShutterTransition({
            message: `strand ${prev + 1} of ${_strands.length}`,
            duration: 800,
            onMidpoint: () => renderStrand(prev)
          });
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (_strands.length > 1) {
          const next = (_currentStrandIdx + 1) % _strands.length;
          playShutterTransition({
            message: `strand ${next + 1} of ${_strands.length}`,
            duration: 800,
            onMidpoint: () => renderStrand(next)
          });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (_focusedNodeIdx > 0) {
          _focusedNodeIdx--;
          highlightFocusedNode();
          const strand = _strands[_currentStrandIdx];
          if (strand?.nodes[_focusedNodeIdx]?.term) {
            showTermDetail(strand.nodes[_focusedNodeIdx].term);
          }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (_strands[_currentStrandIdx] && _focusedNodeIdx < _strands[_currentStrandIdx].nodes.length - 1) {
          _focusedNodeIdx++;
          highlightFocusedNode();
          const strand = _strands[_currentStrandIdx];
          if (strand?.nodes[_focusedNodeIdx]?.term) {
            showTermDetail(strand.nodes[_focusedNodeIdx].term);
          }
        }
        break;
    }
  };

  document.addEventListener('keydown', _keyHandler);
}

// ── Filter integration (listens for sidebar filter events to avoid circular imports) ──
document.addEventListener('gallery-filters-changed', () => {
  if (galleryActive) applyGalleryFilters();
});
