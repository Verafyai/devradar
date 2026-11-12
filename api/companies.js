import { clientIp, cookies, method, rateLimit, readJson, sendJson } from "../lib/http.js";
import { createCompany, listCompanies, removeCompany, setActiveCompany, updateCompany, userFromSessionToken } from "../lib/users.js";

async function requireUser(req, res) {
  const user = await userFromSessionToken(cookies(req).dr_session);
  if (!user) {
    sendJson(res, 401, { error: "Sign in to save a company." });
    return null;
  }
  return user;
}

export default async function handler(req, res) {
  const verb = method(req);
  if (!rateLimit(`companies:${clientIp(req)}`, 60, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many company updates. Try again later." });
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    if (verb === "GET") {
      const data = await listCompanies(user.id);
      return sendJson(res, 200, data);
    }
    if (verb === "POST") {
      const body = await readJson(req);
      const company = await createCompany(user.id, body);
      const data = await listCompanies(user.id);
      return sendJson(res, 200, { company, ...data });
    }
    if (verb === "PATCH") {
      const body = await readJson(req);
      const id = String(body.id || "");
      if (!id) return sendJson(res, 400, { error: "Choose a company." });
      if (body.active === true) {
        const company = await setActiveCompany(user.id, id);
        if (!company) return sendJson(res, 404, { error: "That company is not on your profile." });
        const data = await listCompanies(user.id);
        return sendJson(res, 200, data);
      }
      const company = await updateCompany(user.id, id, body);
      if (!company) return sendJson(res, 404, { error: "That company is not on your profile." });
      const data = await listCompanies(user.id);
      return sendJson(res, 200, { company, ...data });
    }
    if (verb === "DELETE") {
      const url = new URL(req.url || "/", "http://localhost");
      let id = url.searchParams.get("id") || "";
      if (!id) {
        const body = await readJson(req).catch(() => ({}));
        id = String(body.id || "");
      }
      const data = await removeCompany(user.id, id);
      if (!data) return sendJson(res, 404, { error: "That company is not on your profile." });
      return sendJson(res, 200, data);
    }
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (err) {
    return sendJson(res, 400, { error: err instanceof Error ? err.message : "The company could not be saved." });
  }
}
