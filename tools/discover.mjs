/**
 * tools/discover.mjs
 *
 * Parses ruliad_expedition_v1.1.html with acorn and prints every top-level
 * symbol name, its node type, and its line number.
 *
 * Usage: node tools/discover.mjs [--json]
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'ruliad_expedition_v1.1.html');
const JSON_MODE = process.argv.includes('--json');

const html = await readFile(HTML_FILE, 'utf8');

// Extract the JS block between the last <script> and </script>
const scriptStart = html.lastIndexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
if (scriptStart === -1 || scriptEnd === -1) {
  console.error('Could not find <script>...</script> block.');
  process.exit(1);
}
const jsText = html.slice(scriptStart + '<script>'.length, scriptEnd);

// Count line offset so we can report HTML line numbers
const htmlLinesBefore = html.slice(0, scriptStart + '<script>'.length).split('\n').length;

let ast;
try {
  ast = parse(jsText, { ecmaVersion: 2022, sourceType: 'script', locations: true });
} catch (err) {
  console.error('acorn parse error:', err.message);
  process.exit(1);
}

/** Extract the primary name(s) from a top-level AST node */
function getNames(node) {
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return node.id ? [node.id.name] : ['(anonymous)'];
    case 'VariableDeclaration':
      return node.declarations.map(d => (d.id?.name ?? '(destructure)'));
    case 'ExpressionStatement':
      return ['(expression)'];
    default:
      return [`(${node.type})`];
  }
}

/** Best-effort "kind" label for display */
function kindOf(node) {
  switch (node.type) {
    case 'FunctionDeclaration': return node.async ? 'async function' : 'function';
    case 'ClassDeclaration':   return 'class';
    case 'VariableDeclaration': return node.kind; // const | let | var
    case 'ExpressionStatement': return 'expression';
    default: return node.type;
  }
}

const symbols = [];
for (const node of ast.body) {
  const names = getNames(node);
  const kind = kindOf(node);
  const line = (htmlLinesBefore - 1) + node.loc.start.line; // approx HTML line
  for (const name of names) {
    symbols.push({ name, kind, jsLine: node.loc.start.line, htmlLine: line });
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify(symbols, null, 2));
} else {
  // Human-readable table
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('NAME', 60) + pad('KIND', 20) + pad('JS_LINE', 10) + 'HTML_LINE');
  console.log('-'.repeat(100));
  for (const s of symbols) {
    console.log(pad(s.name, 60) + pad(s.kind, 20) + pad(s.jsLine, 10) + s.htmlLine);
  }
  console.log(`\nTotal: ${symbols.length} top-level symbols`);
}
