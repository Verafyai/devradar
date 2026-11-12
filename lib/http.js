import { randomBytes } from "node:crypto";

export function cookies(req) {
  const out = {};
  const raw = req.headers?.cookie || "";
  for (const part of String(raw).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "local";
}

export function originOf(req) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = String(req.headers?.["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function isLocalRequest(req) {
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim().toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
    return req.body;
  }
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body instanceof Uint8Array) return Buffer.from(req.body).toString("utf8");
  if (typeof req[Symbol.asyncIterator] !== "function") return "";
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(req) {
  const body = await readBody(req);
  if (body && typeof body === "object") return body;
  if (!body || !String(body).trim()) return {};
  return JSON.parse(String(body));
}

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

export function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(html);
}

export function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader("location", location);
  res.setHeader("cache-control", "no-store");
  res.end("");
}

export function setSessionCookie(res, req, token) {
  const proto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const bits = [
    `dr_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (proto === "https") bits.push("Secure");
  res.setHeader("set-cookie", bits.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("set-cookie", "dr_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

const hits = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function newId(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

export function cleanText(value, max) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function looksLikeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function method(req) {
  return String(req.method || "GET").toUpperCase();
}
