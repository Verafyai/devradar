import { clientIp, cookies, method, rateLimit, sendJson } from "../lib/http.js";
import { listCompanies, providerFlags, publicUser, userFromSessionToken } from "../lib/users.js";

export default async function handler(req, res) {
  if (method(req) !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  if (!rateLimit(`session:${clientIp(req)}`, 120, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many requests." });
  const token = cookies(req).dr_session;
  const user = await userFromSessionToken(token);
  const companies = user ? await listCompanies(user.id) : { companies: [], activeCompany: null };
  return sendJson(res, 200, {
    user: publicUser(user),
    companies: companies.companies,
    activeCompany: companies.activeCompany,
    providers: providerFlags(),
  });
}
