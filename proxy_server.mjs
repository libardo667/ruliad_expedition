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

async function fetchUrlHandler(req, res) {
  const body = await readJsonBody(req);
  const urls = Array.isArray(body.urls) ? body.urls.slice(0, 10) : [];
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const resp = await fetch(String(url), {
        headers: { "User-Agent": "Ruliad Expedition Tool/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000)
      });
      const contentType = resp.headers.get("content-type") || "";
      const raw = await resp.text();
      const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/is);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const isXml = contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom")
        || raw.trimStart().startsWith("<?xml") || raw.trimStart().startsWith("<rss") || raw.trimStart().startsWith("<feed");
      return { url, title, text: text.slice(0, 12000), contentType, raw: isXml ? raw.slice(0, 60000) : undefined, ok: true };
    } catch (err) {
      return { url, title: "", text: "", contentType: "", ok: false, error: String(err?.message || err) };
    }
  }));
  send(res, 200, JSON.stringify({ results }), { "Content-Type": MIME[".json"] });
}

function safeJoin(root, requestPath) {
  const clean = decodeURIComponent(requestPath.split("?")[0]).replace(/^\//, "");
  const full = path.resolve(root, clean);
  if (!full.startsWith(path.resolve(root))) return null;
  return full;
}

async function resolveDefaultRequestPath() {
  const candidates = [
    "/ruliad_expedition_modular.html",
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
  return "/ruliad_expedition_modular.html";
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
    if (req.method === "POST" && pathname === "/api/fetch-url") return await fetchUrlHandler(req, res);
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
  console.log("[proxy] endpoints: /api/llm/chat/completions, /api/llm/embeddings, /api/fetch-url");
});
