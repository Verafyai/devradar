import { clearSessionCookie, cookies, method, sendJson } from "../lib/http.js";
import { destroySession } from "../lib/users.js";

export default async function handler(req, res) {
  if (method(req) !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  const token = cookies(req).dr_session;
  await destroySession(token);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}
