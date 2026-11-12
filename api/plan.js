import { cookies, method, readJson, sendJson } from "../lib/http.js";
import { readDoc } from "../lib/store.js";
import { addPlanItem, getPlan, removePlanItem, userFromSessionToken } from "../lib/users.js";

export default async function handler(req, res) {
  const user = await userFromSessionToken(cookies(req).dr_session);
  if (!user) return sendJson(res, 401, { error: "Sign in to save events to a plan." });
  const verb = method(req);
  try {
    if (verb === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const companyId = url.searchParams.get("companyId") || "";
      const company = await readDoc(`users/${user.id}/companies/${companyId}`);
      if (!company) return sendJson(res, 404, { error: "That company is not on your profile." });
      const items = await getPlan(companyId);
      return sendJson(res, 200, { items });
    }
    const body = await readJson(req);
    const companyId = String(body.companyId || "");
    if (!companyId) return sendJson(res, 400, { error: "Save a company before adding events to a plan." });
    if (verb === "POST") {
      const event = body.event;
      if (!event?.id || !event?.name) return sendJson(res, 400, { error: "Choose an event to add." });
      const items = await addPlanItem(user.id, companyId, {
        id: String(event.id),
        name: String(event.name).slice(0, 160),
        url: String(event.url || "").slice(0, 400),
        startDate: String(event.startDate || ""),
        endDate: String(event.endDate || ""),
        month: String(event.month || ""),
        day: String(event.day || ""),
        location: String(event.location || ""),
        description: String(event.description || "").slice(0, 200),
        fit: Number(event.fit) || 0,
        action: String(event.action || "").slice(0, 80),
      });
      if (!items) return sendJson(res, 404, { error: "That company is not on your profile." });
      return sendJson(res, 200, { items });
    }
    if (verb === "DELETE") {
      const items = await removePlanItem(user.id, companyId, String(body.eventId || ""));
      if (!items) return sendJson(res, 404, { error: "That company is not on your profile." });
      return sendJson(res, 200, { items });
    }
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (err) {
    return sendJson(res, 400, { error: err instanceof Error ? err.message : "The plan could not be updated." });
  }
}
