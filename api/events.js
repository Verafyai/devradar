import { clientIp, method, rateLimit, readJson, sendJson } from "../lib/http.js";
import { loadConferences, rankEvents, WINDOWS } from "../lib/events.js";

export default async function handler(req, res) {
  if (method(req) !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!rateLimit(`events:${clientIp(req)}`, 40, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many event searches. Try again later." });
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Enter a target market, a location, and a time window." });
  }
  const market = String(body.market || "").trim();
  const location = String(body.location || "").trim();
  const months = Number(body.window);
  if (!market) return sendJson(res, 400, { error: "Enter a target market." });
  if (!location) return sendJson(res, 400, { error: "Enter a target location, or Online." });
  if (!WINDOWS.includes(months)) return sendJson(res, 400, { error: "Choose a window of 1, 3, 6, or 12 months." });
  try {
    const conferences = await loadConferences();
    const events = rankEvents(conferences, { market, location, months }, new Date());
    return sendJson(res, 200, {
      events,
      count: events.length,
      source: "confs.tech",
      note: "Ranked by fit with your market. Dates come from the public confs.tech conference calendar.",
    });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : "Event search failed." });
  }
}
