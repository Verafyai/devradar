import { method, newId, originOf, redirect, sendJson } from "../lib/http.js";
import { saveOauthState } from "../lib/users.js";

function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export default async function handler(req, res) {
  if (method(req) !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const url = new URL(req.url || "/", "http://localhost");
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((name) => !process.env[name]?.trim());
  if (url.searchParams.get("check") === "1") return sendJson(res, 200, { configured: configured(), missing });
  if (!configured()) {
    return sendJson(res, 501, { configured: false, missing, error: "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server." });
  }
  const state = newId(18);
  await saveOauthState(state, { provider: "google" });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    redirect_uri: `${originOf(req)}/api/auth-callback?provider=google`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
