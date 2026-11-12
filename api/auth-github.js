import { method, newId, originOf, redirect, sendJson } from "../lib/http.js";
import { saveOauthState } from "../lib/users.js";

function configured() {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

export default async function handler(req, res) {
  if (method(req) !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const url = new URL(req.url || "/", "http://localhost");
  const missing = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"].filter((name) => !process.env[name]?.trim());
  if (url.searchParams.get("check") === "1") return sendJson(res, 200, { configured: configured(), missing });
  if (!configured()) {
    return sendJson(res, 501, { configured: false, missing, error: "GitHub sign-in needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server." });
  }
  const state = newId(18);
  await saveOauthState(state, { provider: "github" });
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID.trim(),
    redirect_uri: `${originOf(req)}/api/auth-callback?provider=github`,
    scope: "read:user user:email",
    state,
  });
  return redirect(res, `https://github.com/login/oauth/authorize?${params}`);
}
