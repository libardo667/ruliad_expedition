/**
 * tools/extract-utils.mjs
 * Helper functions for the HTML → ES-module decomposition.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ── HTML section extraction ────────────────────────────────────────────────────

/**
 * Extract the text content of the first occurrence of <tag>...</tag>.
 * Returns { content, startIdx, endIdx } or null.
 */
export function extractHTMLTag(html, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const s = html.indexOf(open);
  if (s === -1) return null;
  const e = html.indexOf(close, s);
  if (e === -1) return null;
  return {
    content: html.slice(s + open.length, e),
    startIdx: s,
    endIdx: e + close.length,
  };
}

/**
 * Extract the LAST <script>…</script> block (the app script, not any CDN scripts).
 */
export function extractLastScript(html) {
  const open = '<script>';
  const close = '</script>';
  const s = html.lastIndexOf(open);
  if (s === -1) return null;
  const e = html.lastIndexOf(close);
  if (e === -1) return null;
  return {
    content: html.slice(s + open.length, e),
    startIdx: s,
    endIdx: e + close.length,
  };
}

// ── AST symbol extraction ──────────────────────────────────────────────────────

/**
 * From an acorn AST body array + the JS source text, produce a flat list of
 * top-level "entries" — one per declaration (splitting multi-declarator lets).
 *
 * Each entry: { name, names[], rawText, nodeType, kind, jsLine }
 *   - name   : primary name for map lookup (first declarator for VariableDeclaration)
 *   - names  : all names in this node (for multi-declarator var decls)
 *   - rawText: the extracted source text for this entry
 *   - nodeType: 'VariableDeclaration' | 'FunctionDeclaration' | 'ClassDeclaration' | 'ExpressionStatement' | ...
 *   - kind   : 'const' | 'let' | 'var' | 'function' | 'async function' | 'class' | 'expression' | ...
 *   - jsLine : 1-based line number within the JS block
 */
export function findTopLevelEntries(ast, jsText) {
  const entries = [];

  for (const node of ast.body) {
    const jsLine = node.loc.start.line;
    const rawText = jsText.slice(node.start, node.end);

    if (node.type === 'VariableDeclaration') {
      // Split each declarator into its own entry so we can route them individually.
      for (const decl of node.declarations) {
        const name = decl.id?.name ?? '(destructure)';
        // Re-emit as a standalone declaration: "const name = init;"
        const initText = decl.init ? jsText.slice(decl.init.start, decl.init.end) : 'undefined';
        const declText = `${node.kind} ${jsText.slice(decl.id.start, decl.id.end)}=${initText};`;
        entries.push({
          name,
          names: [name],
          rawText: declText,
          nodeType: 'VariableDeclaration',
          kind: node.kind,
          jsLine,
        });
      }
    } else if (node.type === 'FunctionDeclaration') {
      const name = node.id?.name ?? '(anonymous)';
      const isAsync = node.async;
      entries.push({
        name,
        names: [name],
        rawText,
        nodeType: 'FunctionDeclaration',
        kind: isAsync ? 'async function' : 'function',
        jsLine,
      });
    } else if (node.type === 'ClassDeclaration') {
      const name = node.id?.name ?? '(anonymous)';
      entries.push({
        name,
        names: [name],
        rawText,
        nodeType: 'ClassDeclaration',
        kind: 'class',
        jsLine,
      });
    } else {
      // ExpressionStatement, IfStatement, ForOfStatement, etc.
      entries.push({
        name: `(expression)`,
        names: [],
        rawText,
        nodeType: node.type,
        kind: 'expression',
        jsLine,
      });
    }
  }

  return entries;
}

// ── Export keyword injection ───────────────────────────────────────────────────

/**
 * Prepend "export " to a declaration if it doesn't already have it.
 * Does NOT export expressions.
 */
export function injectExport(rawText, nodeType) {
  if (nodeType === 'ExpressionStatement' || nodeType === 'IfStatement' || nodeType === 'ForOfStatement') {
    return rawText; // no export
  }
  if (rawText.startsWith('export ')) return rawText;
  return 'export ' + rawText;
}

// ── File writing helpers ───────────────────────────────────────────────────────

/**
 * Ensure all parent directories exist, then write a file.
 */
export async function writeModuleFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

/**
 * Compute the relative import path from one module file to another.
 * e.g. from 'js/ui/tabs.js' to 'js/core/state.js' → '../core/state.js'
 */
export function relImport(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel : './' + rel;
}

// ── Dependency scanning ────────────────────────────────────────────────────────

/**
 * Given the raw source text of a module file and the full SYMBOL_MAP,
 * return an object { importFile → Set<symbolName> } describing what
 * symbols from other files are referenced in this text.
 *
 * Strategy: simple word-boundary identifier scan (not full AST).
 * Fast and sufficient for a first-pass decomposition.
 */
export function resolveImports(moduleFile, sourceText, symbolMap) {
  const needed = {}; // toFile → Set<name>

  for (const [name, targetFile] of Object.entries(symbolMap)) {
    if (name.startsWith('(') || name.startsWith('@')) continue; // skip pseudo-names
    if (targetFile === moduleFile) continue; // same file
    // Word-boundary match: \bNAME\b
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (re.test(sourceText)) {
      if (!needed[targetFile]) needed[targetFile] = new Set();
      needed[targetFile].add(name);
    }
  }
  return needed;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
