import { method, originOf, redirect, sendJson, setSessionCookie } from "../lib/http.js";
import { createSession, takeOauthState, upsertUser } from "../lib/users.js";

async function githubProfile(code, redirectUri) {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "DevRadar" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID.trim(),
      client_secret: process.env.GITHUB_CLIENT_SECRET.trim(),
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!token.access_token) throw new Error("GitHub did not return an access token.");
  const headers = { authorization: `Bearer ${token.access_token}`, accept: "application/vnd.github+json", "user-agent": "DevRadar" };
  const userRes = await fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15000) });
  const user = await userRes.json();
  let email = user.email || "";
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(15000) });
    const emails = await emailsRes.json().catch(() => []);
    const list = Array.isArray(emails) ? emails : [];
    const primary = list.find((row) => row.primary && row.verified) || list.find((row) => row.verified) || list[0];
    email = primary?.email || "";
  }
  if (!email) email = `${user.id}+${user.login}@users.noreply.github.com`;
  return { email, name: user.name || user.login || "", avatarUrl: user.avatar_url || "", providerId: String(user.id || "") };
}

async function googleProfile(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!token.access_token) throw new Error("Google did not return an access token.");
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  const profile = await profileRes.json();
  if (!profile.email) throw new Error("Google did not share an email address.");
  return { email: profile.email, name: profile.name || "", avatarUrl: profile.picture || "", providerId: String(profile.id || "") };
}

export default async function handler(req, res) {
  if (method(req) !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const url = new URL(req.url || "/", "http://localhost");
  const provider = url.searchParams.get("provider");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const denied = url.searchParams.get("error");
  if (denied) return redirect(res, `/?auth_error=${encodeURIComponent("Sign-in was cancelled.")}`);
  const saved = await takeOauthState(state);
  if (!saved || saved.provider !== provider || (provider !== "github" && provider !== "google") || !code) {
    return redirect(res, `/?auth_error=${encodeURIComponent("That sign-in attempt expired. Try again.")}`);
  }
  try {
    const redirectUri = `${originOf(req)}/api/auth-callback?provider=${provider}`;
    const profile = provider === "github" ? await githubProfile(code, redirectUri) : await googleProfile(code, redirectUri);
    const user = await upsertUser({ ...profile, provider });
    const session = await createSession(user.id);
    setSessionCookie(res, req, session);
    return redirect(res, "/?signedin=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed.";
    return redirect(res, `/?auth_error=${encodeURIComponent(message)}`);
  }
}
