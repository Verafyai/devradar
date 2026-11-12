import { clientIp, method, rateLimit, readJson, sendJson, validEmail } from "../lib/http.js";
import { addWaitlist } from "../lib/users.js";

const APPS = new Set([
  "developer-profiler",
  "social-trends",
  "influencers",
  "docs-scanner",
  "looper",
  "competition",
  "ideas",
]);

export default async function handler(req, res) {
  if (method(req) !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!rateLimit(`waitlist:${clientIp(req)}`, 20, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many waitlist requests. Try again later." });
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Enter an email address." });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const app = String(body.app || "");
  if (!validEmail(email)) return sendJson(res, 400, { error: "Enter a valid email address." });
  if (!APPS.has(app)) return sendJson(res, 400, { error: "That app is not on the waitlist." });
  const result = await addWaitlist(email, app);
  return sendJson(res, 200, { ok: true, created: result.created });
}
