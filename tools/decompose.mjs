/**
 * tools/decompose.mjs
 *
 * One-time migration tool: splits ruliad_expedition_v1.1.html into ES modules.
 *
 * Usage:
 *   cd <project-root>
 *   node tools/decompose.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   Print what would be written without actually writing files.
 *   --no-window Don't emit window.* assignments (use if you want pure ESM).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse }                       from 'acorn';
import path                            from 'node:path';
import { fileURLToPath }               from 'node:url';

import {
  extractHTMLTag,
  extractLastScript,
  findTopLevelEntries,
  injectExport,
  writeModuleFile,
  relImport,
  resolveImports,
} from './extract-utils.mjs';

import { SYMBOL_MAP, BOOTSTRAP_LINE_RANGE } from './module-map.mjs';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const HTML_SRC  = path.join(ROOT, 'ruliad_expedition_v1.1.html');
// Write new entry point as a separate file to preserve the original as a reference.
// Rename to ruliad_expedition_v1.1.html once verified working.
const HTML_OUT  = path.join(ROOT, 'ruliad_expedition_modular.html');
const CSS_OUT   = path.join(ROOT, 'css', 'styles.css');
const JS_ROOT   = path.join(ROOT, 'js');
const MAIN_JS   = path.join(JS_ROOT, 'main.js');
const UNMAPPED  = 'js/core/unmapped.js';

const DRY_RUN      = process.argv.includes('--dry-run');
const NO_WINDOW    = process.argv.includes('--no-window');

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(...args) { console.log(...args); }
function warn(...args) { console.warn('⚠ ', ...args); }

async function emit(filePath, content) {
  if (DRY_RUN) {
    log(`[DRY] Would write ${filePath} (${content.length} chars)`);
    return;
  }
  await writeModuleFile(filePath, content);
  log(`  ✓  ${filePath}`);
}

// ── Phase 1: Read & extract HTML sections ─────────────────────────────────────

log('\n=== Phase 1: Extracting HTML sections ===');
const html = await readFile(HTML_SRC, 'utf8');

// CSS
const styleBlock = extractHTMLTag(html, 'style');
if (!styleBlock) { console.error('No <style> block found.'); process.exit(1); }
const cssContent = styleBlock.content.trim();

// JS
const scriptBlock = extractLastScript(html);
if (!scriptBlock) { console.error('No <script> block found.'); process.exit(1); }
const jsText = scriptBlock.content;
const htmlLinesBefore = html.slice(0, scriptBlock.startIdx + '<script>'.length).split('\n').length;

log(`  CSS: ${cssContent.length} chars`);
log(`  JS:  ${jsText.length} chars`);

// New HTML: strip inline <style> and <script>, add external refs
const newHtml = html
  // Replace <style>...</style> with link tag
  .replace(
    html.slice(styleBlock.startIdx, styleBlock.endIdx),
    '<link rel="stylesheet" href="css/styles.css"/>'
  )
  // Replace <script>...</script> (the app script) with module tag
  .replace(
    html.slice(scriptBlock.startIdx, scriptBlock.endIdx),
    '<script type="module" src="js/main.js"></script>'
  );

// ── Phase 2: Parse JS with acorn ─────────────────────────────────────────────

log('\n=== Phase 2: Parsing JS with acorn ===');
let ast;
try {
  ast = parse(jsText, { ecmaVersion: 2022, sourceType: 'script', locations: true });
} catch (err) {
  console.error('acorn parse error:', err.message);
  process.exit(1);
}

const entries = findTopLevelEntries(ast, jsText);
log(`  Found ${entries.length} top-level entries`);

// ── Phase 3: Route entries to target files ────────────────────────────────────

log('\n=== Phase 3: Routing entries to modules ===');

// fileMap: targetFile → Array<entry>
const fileMap = new Map();

function addToFile(targetFile, entry) {
  if (!fileMap.has(targetFile)) fileMap.set(targetFile, []);
  fileMap.get(targetFile).push(entry);
}

let unmappedCount = 0;
const unmappedNames = [];

for (const entry of entries) {
  // Pure expression/statement nodes (event listeners, init calls, for-of loops, if-blocks)
  // that have no declared name always go to bootstrap.
  if (entry.kind === 'expression') {
    addToFile('js/ui/bootstrap.js', entry);
    continue;
  }

  // Named declarations → look up in SYMBOL_MAP
  const targetFile = SYMBOL_MAP[entry.name];
  if (targetFile) {
    addToFile(targetFile, entry);
  } else {
    warn(`Unmapped symbol: ${entry.name} (${entry.kind}, jsLine ${entry.jsLine})`);
    addToFile(UNMAPPED, entry);
    unmappedCount++;
    unmappedNames.push(entry.name);
  }
}

log(`  Routed to ${fileMap.size} files`);
if (unmappedCount > 0) {
  warn(`${unmappedCount} unmapped symbols → ${UNMAPPED}`);
}

// ── Phase 4: Generate module file content ────────────────────────────────────

log('\n=== Phase 4: Generating module files ===');

// Build a flat name→file map for import resolution (skip pseudo-names)
const namedSymbolMap = Object.fromEntries(
  Object.entries(SYMBOL_MAP).filter(([k]) => !k.startsWith('(') && !k.startsWith('@'))
);

// Collect all unique target files
const allTargetFiles = [...new Set(Object.values(namedSymbolMap))];
// Add bootstrap, unmapped
allTargetFiles.push('js/ui/bootstrap.js', UNMAPPED);

// The set of state-module files whose exports should also be assigned to window.*
const STATE_FILES = new Set([
  'js/core/state.js',
  'js/core/refs.js',
]);

const generatedFiles = new Map(); // targetFile → { content, exportedNames }

for (const [targetFile, fileEntries] of fileMap) {
  const absTarget = path.join(ROOT, targetFile);
  const exportedNames = [];
  const bodyLines = [];

  bodyLines.push(`// Auto-generated by tools/decompose.mjs — edit freely after generation`);
  bodyLines.push(`// Source: ${path.relative(ROOT, HTML_SRC).replace(/\\/g, '/')}`);
  bodyLines.push(`// Module: ${targetFile}`);
  bodyLines.push('');

  // Emit symbol code
  for (const entry of fileEntries) {
    if (entry.kind === 'expression') {
      // Expressions are emitted verbatim (no export)
      bodyLines.push(entry.rawText);
    } else {
      // Inject export keyword
      const exported = injectExport(entry.rawText, entry.nodeType);
      bodyLines.push(exported);
      if (entry.name && !entry.name.startsWith('(')) {
        exportedNames.push(entry.name);
      }
    }
    bodyLines.push('');
  }

  // For state / refs files: add window.* assignments for hybrid compatibility
  if (!NO_WINDOW && exportedNames.length > 0 && STATE_FILES.has(targetFile)) {
    bodyLines.push('// Hybrid compatibility: modules import via export, legacy call-sites use window.*');
    bodyLines.push('// Remove once all modules import directly from this file.');
    bodyLines.push(`Object.assign(window, { ${exportedNames.join(', ')} });`);
    bodyLines.push('');
  }

  const content = bodyLines.join('\n');
  generatedFiles.set(targetFile, { content, exportedNames, absPath: absTarget });
}

// ── Phase 5: Resolve & inject imports ────────────────────────────────────────

log('\n=== Phase 5: Resolving imports ===');

const finalContents = new Map(); // targetFile → finalContent

for (const [targetFile, { content, exportedNames, absPath }] of generatedFiles) {
  // Find references to symbols defined in OTHER files
  const needed = resolveImports(targetFile, content, namedSymbolMap);

  const importLines = [];
  for (const [fromFile, names] of Object.entries(needed)) {
    if (fromFile === targetFile) continue;
    const rel = relImport(targetFile, fromFile);
    const sortedNames = [...names].sort();
    // Only import names that are actually exported from that file
    const fromEntries = generatedFiles.get(fromFile);
    const available = fromEntries
      ? sortedNames.filter(n => fromEntries.exportedNames.includes(n))
      : sortedNames;
    if (available.length > 0) {
      importLines.push(`import { ${available.join(', ')} } from '${rel}';`);
    }
  }

  const header = importLines.length > 0
    ? importLines.join('\n') + '\n\n'
    : '';

  finalContents.set(targetFile, header + content);
}

// ── Phase 6: Generate js/main.js ─────────────────────────────────────────────

log('\n=== Phase 6: Generating js/main.js ===');

const moduleFiles = [...fileMap.keys()]
  .filter(f => f !== 'js/ui/bootstrap.js')
  .sort();

const mainLines = [
  '// js/main.js — auto-generated entry point',
  '// Import order: core → api → domain → grounding → pipeline → embedding → plot → artifacts → ui → io',
  '//',
  '// Imports are side-effect only for now (all symbols also assigned to window.* in state/refs).',
  '// As modules mature, replace side-effect imports with named imports.',
  '',
];

// Sort: core first, then roughly dependency order
const ORDER_PREFIXES = [
  'js/core/',
  'js/api/',
  'js/domain/',
  'js/grounding/',
  'js/pipeline/',
  'js/embedding/',
  'js/plot/',
  'js/artifacts/',
  'js/ca/',
  'js/prompt/',
  'js/io/',
  'js/ui/',
];

const sorted = [...fileMap.keys()].filter(f => f !== 'js/ui/bootstrap.js').sort((a, b) => {
  const ai = ORDER_PREFIXES.findIndex(p => a.startsWith(p));
  const bi = ORDER_PREFIXES.findIndex(p => b.startsWith(p));
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
});

for (const f of sorted) {
  const rel = './' + path.relative(JS_ROOT, path.join(ROOT, f)).replace(/\\/g, '/');
  mainLines.push(`import '${rel}';`);
}

mainLines.push('// Bootstrap runs as top-level side effects — safe because ES modules defer by default');
mainLines.push('// (equivalent to <script type="module" defer>), so DOM is ready when this executes.');
mainLines.push(`import './ui/bootstrap.js';`);
mainLines.push('');

const mainContent = mainLines.join('\n');

// ── Phase 7: Write everything ─────────────────────────────────────────────────

log('\n=== Phase 7: Writing files ===');

// CSS
await emit(CSS_OUT, '/* Extracted from ruliad_expedition_v1.1.html <style> block */\n' + cssContent + '\n');

// Module files
for (const [targetFile, content] of finalContents) {
  const absPath = path.join(ROOT, targetFile);
  await emit(absPath, content);
}

// main.js
await emit(MAIN_JS, mainContent);

// Updated HTML
await emit(HTML_OUT, newHtml);

// ── Phase 8: Summary ──────────────────────────────────────────────────────────

log('\n=== Summary ===');
log(`  HTML entry: ${path.relative(ROOT, HTML_OUT)}`);
log(`  CSS:        css/styles.css`);
log(`  JS modules: ${fileMap.size} files written`);
log(`  main.js:    js/main.js`);
if (unmappedCount > 0) {
  warn(`  ${unmappedCount} unmapped symbols in ${UNMAPPED}: ${unmappedNames.slice(0, 10).join(', ')}${unmappedNames.length > 10 ? '…' : ''}`);
} else {
  log(`  ✓ All symbols mapped`);
}
if (DRY_RUN) log('\n[DRY RUN — no files written]');
else log('\n✅ Done. Serve with: node proxy_server.mjs → http://localhost:8787');
