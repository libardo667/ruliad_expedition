import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8787);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const WOLFRAM_APPID = process.env.WOLFRAM_APPID || "";
const WOLFRAM_CACHE_TTL_MS = Math.max(60_000, Number(process.env.WOLFRAM_CACHE_TTL_MS || 1000 * 60 * 60 * 6));
const WOLFRAM_CACHE_MAX = Math.max(50, Number(process.env.WOLFRAM_CACHE_MAX || 2000));
const WOLFRAM_NORMALIZED_CACHE_TTL_MS = Math.max(60_000, Number(process.env.WOLFRAM_NORMALIZED_CACHE_TTL_MS || WOLFRAM_CACHE_TTL_MS));
const WOLFRAM_NORMALIZED_CACHE_MAX = Math.max(50, Number(process.env.WOLFRAM_NORMALIZED_CACHE_MAX || WOLFRAM_CACHE_MAX));
const WOLFRAM_RAW_CACHE = new Map();
const WOLFRAM_NORMALIZED_CACHE = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function normalizeWolframCacheKey(input) {
  return String(input || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function enforceWolframCacheLimit(map, maxEntries) {
  if (map.size <= maxEntries) return;
  const items = [...map.entries()].sort((a, b) => Number(b[1]?.cachedAt || 0) - Number(a[1]?.cachedAt || 0));
  map.clear();
  for (const [key, value] of items.slice(0, maxEntries)) {
    map.set(key, value);
  }
}

function getWolframCacheEntry(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (!Number.isFinite(Number(entry.expiresAt)) || Number(entry.expiresAt) <= Date.now()) {
    map.delete(key);
    return null;
  }
  return entry;
}

function setWolframCacheEntry(map, key, payload, ttlMs, maxEntries) {
  map.set(key, {
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    ...payload
  });
  enforceWolframCacheLimit(map, maxEntries);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function resolveAuth(req) {
  const incoming = req.headers.authorization || "";
  if (incoming.startsWith("Bearer ")) return incoming;
  if (OPENROUTER_API_KEY) return `Bearer ${OPENROUTER_API_KEY}`;
  return "";
}

async function proxyOpenRouter(req, res, kind) {
  const body = await readJsonBody(req);
  const auth = resolveAuth(req);
  if (!auth) {
    send(res, 401, JSON.stringify({ error: "Missing OpenRouter key. Set OPENROUTER_API_KEY or send Authorization header." }), { "Content-Type": MIME[".json"] });
    return;
  }
  const url = kind === "chat"
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://openrouter.ai/api/v1/embeddings";
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": auth,
      "HTTP-Referer": req.headers.origin || "http://localhost",
      "X-Title": "Ruliad Expedition Tool Proxy"
    },
    body: JSON.stringify(body)
  });
  const text = await upstream.text();
  send(res, upstream.status, text, { "Content-Type": upstream.headers.get("content-type") || MIME[".json"] });
}

function compactWolframText(text, maxLen = 420) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function isWolframLowSignalText(text) {
  const t = compactWolframText(text, 320);
  if (!t) return true;
  if (/^(?:none|n\/a|null|unknown|not available|not applicable)$/i.test(t)) return true;
  const canon = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(?:entity|person|location|place|thing|object|item|concept|term|image)$/i.test(canon)) return true;
  return false;
}

function wolframPodTitleScore(title) {
  const t = String(title || "").toLowerCase();
  if (/input interpretation/.test(t)) return 120;
  if (/definition|definitions/.test(t)) return 112;
  if (/basic information/.test(t)) return 102;
  if (/^result$|result /.test(t)) return 98;
  if (/properties/.test(t)) return 92;
  if (/assumption|possible interpretation/.test(t)) return 46;
  if (/name|identity|identification|wikipedia/.test(t)) return 18;
  return 54;
}

function extractWolframListValues(value, maxItems = 8) {
  const out = [];
  const pushIf = (v) => {
    const t = compactWolframText(v, 220);
    if (t && !out.includes(t) && !isWolframLowSignalText(t)) out.push(t);
  };
  const walk = (node) => {
    if (out.length >= maxItems || node === null || node === undefined) return;
    if (typeof node === "string") {
      pushIf(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const x of node) {
        walk(x);
        if (out.length >= maxItems) break;
      }
      return;
    }
    if (typeof node === "object") {
      if (typeof node.plaintext === "string") pushIf(node.plaintext);
      if (typeof node.text === "string") pushIf(node.text);
      if (typeof node.desc === "string") pushIf(node.desc);
      if (typeof node.word === "string" && typeof node.desc === "string") pushIf(`${node.word}: ${node.desc}`);
      if (typeof node.value === "string") pushIf(node.value);
      if (typeof node.name === "string" && !node.desc && !node.text) pushIf(node.name);
      if (typeof node["#text"] === "string") pushIf(node["#text"]);
      for (const key of Object.keys(node)) {
        walk(node[key]);
        if (out.length >= maxItems) break;
      }
    }
  };
  walk(value);
  return out.slice(0, maxItems);
}

function extractWolframNormalized(raw, query) {
  const queryresult = raw?.queryresult && typeof raw.queryresult === "object" ? raw.queryresult : {};
  const pods = Array.isArray(queryresult.pods) ? queryresult.pods : [];
  const candidates = [];
  for (const pod of pods) {
    const title = String(pod?.title || "").trim();
    const base = wolframPodTitleScore(title);
    const subpods = Array.isArray(pod?.subpods) ? pod.subpods : [];
    for (let i = 0; i < subpods.length; i++) {
      const sub = subpods[i];
      const text = compactWolframText(sub?.plaintext, 420);
      if (!text || isWolframLowSignalText(text)) continue;
      let score = base;
      if (text.length < 24) score -= 16;
      if (text.length >= 40 && text.length <= 240) score += 9;
      if (/^\d+(?:\.\d+)?$/.test(text)) score -= 18;
      candidates.push({ title, text, score, podId: String(pod?.id || ""), subpodIndex: i });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const inputInterpretation = (candidates.find((c) => /input interpretation/i.test(c.title))?.text) || "";
  const defCandidates = candidates.filter((c) => /definition|basic information|result|properties/i.test(c.title));
  const best = defCandidates[0] || candidates[0] || null;
  const bestPlaintext = String(best?.text || "").trim();
  const candidateFacts = [];
  for (const c of candidates) {
    if (!c?.text || c.text === bestPlaintext || c.text === inputInterpretation) continue;
    if (candidateFacts.includes(c.text)) continue;
    candidateFacts.push(c.text);
    if (candidateFacts.length >= 6) break;
  }
  const assumptions = extractWolframListValues(queryresult.assumptions ?? queryresult.assumption ?? null, 8);
  const didYouMeans = extractWolframListValues(queryresult.didyoumeans ?? queryresult.didyoumean ?? null, 8);
  const warnings = extractWolframListValues(queryresult.warnings ?? queryresult.warning ?? null, 6);
  let score = 0;
  if (bestPlaintext) score += 0.5;
  else if (candidateFacts.length) score += 0.18;
  if (inputInterpretation) score += 0.12;
  if (best?.title && /definition|basic information|result|properties/i.test(best.title)) score += 0.18;
  if (bestPlaintext && bestPlaintext.length >= 30 && bestPlaintext.length <= 240) score += 0.12;
  if (didYouMeans.length) score -= 0.08;
  if (queryresult.success === false) score = Math.min(score, 0.12);
  score = Math.max(0, Math.min(1, score));
  const confidence = {
    level: score >= 0.78 ? "high" : score >= 0.52 ? "medium" : "low",
    score: Number(score.toFixed(3))
  };
  let status = "no_plaintext";
  if (queryresult.success === false || queryresult.error === true) status = "failed";
  else if (bestPlaintext) status = "ok";
  else if (candidateFacts.length || assumptions.length || didYouMeans.length) status = "partial";
  return {
    query: String(query || "").trim(),
    inputInterpretation,
    bestPlaintext,
    candidateFacts,
    assumptions,
    didYouMeans,
    confidence,
    status,
    warnings,
    chosenPod: String(best?.title || "").trim()
  };
}

async function fetchWolframUpstream({ appid, input, output = "json", format = "plaintext", reinterpret = true }) {
  const params = new URLSearchParams({
    appid,
    input,
    output,
    format,
    reinterpret: String(reinterpret ?? true)
  });
  const url = `https://api.wolframalpha.com/v2/query?${params.toString()}`;
  const upstream = await fetch(url, { method: "GET" });
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || MIME[".json"];
  return { status: upstream.status, ok: upstream.ok, text, contentType, url };
}

async function proxyWolfram(req, res) {
  const body = await readJsonBody(req);
  const input = String(body.input || "").trim();
  const appid = String(body.appid || WOLFRAM_APPID || "").trim();
  if (!input) {
    send(res, 400, JSON.stringify({ error: "Missing input." }), { "Content-Type": MIME[".json"] });
    return;
  }
  if (!appid) {
    send(res, 401, JSON.stringify({ error: "Missing Wolfram AppID. Provide appid in request or set WOLFRAM_APPID." }), { "Content-Type": MIME[".json"] });
    return;
  }
  const cacheKey = normalizeWolframCacheKey(input);
  const cached = getWolframCacheEntry(WOLFRAM_RAW_CACHE, cacheKey);
  if (cached) {
    console.log(`[proxy][wolfram][cache HIT] key="${cacheKey.slice(0, 120)}"`);
    send(res, Number(cached.status || 200), cached.text || "", {
      "Content-Type": cached.contentType || MIME[".json"],
      "X-Wolfram-Cache": "HIT"
    });
    return;
  }
  console.log(`[proxy][wolfram][cache MISS] key="${cacheKey.slice(0, 120)}"`);
  const upstream = await fetchWolframUpstream({
    appid,
    input,
    output: body.output || "json",
    format: body.format || "plaintext",
    reinterpret: body.reinterpret ?? true
  });
  if (upstream.ok) {
    setWolframCacheEntry(WOLFRAM_RAW_CACHE, cacheKey, { status: upstream.status, text: upstream.text, contentType: upstream.contentType }, WOLFRAM_CACHE_TTL_MS, WOLFRAM_CACHE_MAX);
  }
  send(res, upstream.status, upstream.text, { "Content-Type": upstream.contentType, "X-Wolfram-Cache": "MISS" });
}

async function proxyWolframNormalized(req, res) {
  const body = await readJsonBody(req);
  const input = String(body.input || "").trim();
  const appid = String(body.appid || WOLFRAM_APPID || "").trim();
  const debug = Boolean(body.debug || body.includeRaw);
  if (!input) {
    send(res, 400, JSON.stringify({ error: "Missing input." }), { "Content-Type": MIME[".json"] });
    return;
  }
  if (!appid) {
    send(res, 401, JSON.stringify({ error: "Missing Wolfram AppID. Provide appid in request or set WOLFRAM_APPID." }), { "Content-Type": MIME[".json"] });
    return;
  }
  const cacheKey = normalizeWolframCacheKey(input);
  const cached = !debug ? getWolframCacheEntry(WOLFRAM_NORMALIZED_CACHE, cacheKey) : null;
  if (cached) {
    console.log(`[proxy][wa/normalize][cache HIT] key="${cacheKey.slice(0, 120)}"`);
    send(res, 200, JSON.stringify(cached.payload), {
      "Content-Type": MIME[".json"],
      "X-Wolfram-Cache": "HIT"
    });
    return;
  }
  console.log(`[proxy][wa/normalize][cache MISS] key="${cacheKey.slice(0, 120)}"`);
  const upstream = await fetchWolframUpstream({
    appid,
    input,
    output: body.output || "json",
    format: body.format || "plaintext",
    reinterpret: body.reinterpret ?? true
  });
  let rawJson = null;
  if (typeof upstream.text === "string" && upstream.text.trim()) {
    try {
      rawJson = JSON.parse(upstream.text);
    } catch {
      rawJson = null;
    }
  }
  const normalized = extractWolframNormalized(rawJson || {}, input);
  const payload = debug
    ? {
      normalized,
      raw: rawJson || upstream.text,
      meta: {
        upstreamStatus: upstream.status,
        upstreamOk: upstream.ok,
        contentType: upstream.contentType
      }
    }
    : normalized;
  if (upstream.ok && !debug) {
    setWolframCacheEntry(
      WOLFRAM_NORMALIZED_CACHE,
      cacheKey,
      { payload },
      WOLFRAM_NORMALIZED_CACHE_TTL_MS,
      WOLFRAM_NORMALIZED_CACHE_MAX
    );
  }
  const statusCode = upstream.ok ? 200 : upstream.status;
  send(res, statusCode, JSON.stringify(payload), {
    "Content-Type": MIME[".json"],
    "X-Wolfram-Cache": "MISS"
  });
}

function safeJoin(root, requestPath) {
  const clean = decodeURIComponent(requestPath.split("?")[0]).replace(/^\//, "");
  const full = path.resolve(root, clean);
  if (!full.startsWith(path.resolve(root))) return null;
  return full;
}

async function resolveDefaultRequestPath() {
  const candidates = [
    "/ruliad_expedition_v1.1.html",
    "/ruliad_expedition_2.23.26.html",
    "/ruliad_expedition.html",
    "/ruliad_expedition copy.html",
    "/index.html"
  ];
  for (const candidate of candidates) {
    const full = safeJoin(ROOT, candidate);
    if (!full) continue;
    try {
      const info = await stat(full);
      if (info.isFile()) return candidate;
    } catch {
      // Candidate missing; keep searching.
    }
  }
  return "/ruliad_expedition_2.23.26.html";
}

async function serveStatic(req, res) {
  if (req.url === "/favicon.ico") {
    send(res, 204, "");
    return;
  }
  const reqPath = (req.url || "").split("?")[0] === "/" ? await resolveDefaultRequestPath() : req.url;
  const full = safeJoin(ROOT, reqPath || "/");
  if (!full) {
    send(res, 403, "Forbidden", { "Content-Type": MIME[".txt"] });
    return;
  }
  try {
    const info = await stat(full);
    if (info.isDirectory()) {
      send(res, 403, "Directory listing disabled", { "Content-Type": MIME[".txt"] });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(full).pipe(res);
  } catch {
    send(res, 404, "Not found", { "Content-Type": MIME[".txt"] });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;
    if (req.method === "POST" && pathname === "/api/llm/chat/completions") return await proxyOpenRouter(req, res, "chat");
    if (req.method === "POST" && pathname === "/api/llm/embeddings") return await proxyOpenRouter(req, res, "embeddings");
    if (req.method === "POST" && pathname === "/api/wolfram/query") return await proxyWolfram(req, res);
    if (req.method === "POST" && (pathname === "/wa/normalize" || pathname === "/api/wolfram/normalize")) return await proxyWolframNormalized(req, res);
    if (req.method === "GET" || req.method === "HEAD") return await serveStatic(req, res);
    send(res, 405, "Method not allowed", { "Content-Type": MIME[".txt"] });
  } catch (err) {
    const msg = err?.message || String(err);
    send(res, 500, JSON.stringify({ error: msg }), { "Content-Type": MIME[".json"] });
  }
});

server.listen(PORT, () => {
  console.log(`[proxy] serving ${ROOT}`);
  console.log(`[proxy] http://localhost:${PORT}`);
  console.log("[proxy] endpoints: /api/llm/chat/completions, /api/llm/embeddings, /api/wolfram/query, /wa/normalize");
});
