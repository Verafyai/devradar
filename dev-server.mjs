import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vercel from "./vercel.json" with { type: "json" };

const port = Number(process.env.PORT || 43123);
const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const handlers = new Map();

function matchRule(source, pathname) {
  const names = [];
  const pattern = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
    names.push(name);
    return "([^/]+)";
  });
  const match = new RegExp(`^${pattern}$`).exec(pathname);
  if (!match) return null;
  const params = {};
  names.forEach((name, index) => { params[name] = decodeURIComponent(match[index + 1]); });
  return params;
}

function fill(template, params) {
  let output = template;
  for (const [key, value] of Object.entries(params)) output = output.replaceAll(`:${key}`, encodeURIComponent(value));
  return output;
}

async function serveStatic(pathname, res) {
  const relative = pathname.replace(/^\/+/, "");
  const candidates = [relative, path.join(relative, "index.html")];
  if (!relative) candidates.unshift("index.html");
  for (const candidate of candidates) {
    const file = path.resolve(root, candidate);
    if (!file.startsWith(root)) continue;
    if (candidate.split(path.sep).some((part) => part === ".git" || part === "node_modules" || part === ".data" || part === ".vercel")) continue;
    try {
      const info = await stat(file);
      if (!info.isFile()) continue;
      const body = await readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(body);
      return true;
    } catch {
      /* try the next candidate */
    }
  }
  return false;
}

async function serveApi(pathname, search, req, res) {
  const clean = pathname.replace(/\/$/, "") || pathname;
  const file = path.join(root, `${clean}.js`);
  if (!file.startsWith(path.join(root, "api"))) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found." }));
    return;
  }
  req.url = clean + search;
  let handler = handlers.get(file);
  if (!handler) {
    const loaded = await import(pathToFileURL(file).href);
    handler = loaded.default;
    handlers.set(file, handler);
  }
  await handler(req, res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.length > 1 && pathname.endsWith("/")) {
      res.writeHead(308, { location: pathname.slice(0, -1) + url.search });
      res.end();
      return;
    }
    for (const rule of vercel.redirects || []) {
      const params = matchRule(rule.source, pathname);
      if (!params) continue;
      res.writeHead(rule.permanent ? 308 : 307, { location: fill(rule.destination, params) });
      res.end();
      return;
    }
    for (const rule of vercel.rewrites || []) {
      const params = matchRule(rule.source, pathname);
      if (!params) continue;
      const next = new URL(fill(rule.destination, params), "http://localhost");
      pathname = next.pathname;
      for (const [key, value] of next.searchParams) url.searchParams.set(key, value);
      break;
    }
    if (pathname.startsWith("/api/")) {
      await serveApi(pathname, url.search, req, res);
      return;
    }
    if (await serveStatic(pathname, res)) return;
    const missing = await readFile(path.join(root, "404.html"));
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(missing);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(err instanceof Error ? err.message : "Server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`DevRadar listening on http://127.0.0.1:${port}`);
});
