import { clientIp, isLocalRequest, method, originOf, rateLimit, readJson, redirect, sendHtml, sendJson, setSessionCookie, validEmail } from "../lib/http.js";
import { createMagic, providerFlags } from "../lib/users.js";

function missingEmailConfig() {
  const missing = [];
  if (!process.env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!process.env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  return missing;
}

async function sendWithResend(email, link) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM.trim(),
      to: email,
      subject: "Your DevRadar sign-in link",
      text: `Sign in to DevRadar:\n${link}\n\nThis link expires in 30 minutes. If you did not ask for it, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.slice(0, 180) || `Email provider returned HTTP ${response.status}.`);
  }
}

export default async function handler(req, res) {
  const verb = method(req);
  if (verb === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const token = url.searchParams.get("token") || "";
    if (!token) return sendJson(res, 400, { error: "That sign-in link is missing a token." });
    const { consumeMagic, createSession, upsertUser } = await import("../lib/users.js");
    const email = await consumeMagic(token);
    if (!email) return sendHtml(res, 400, "<!DOCTYPE html><title>Link expired</title><p>That sign-in link has expired. Go back to DevRadar and request a new one.</p><p><a href=\"/\">Back to DevRadar</a></p>");
    const local = email.split("@")[0] || "there";
    const name = local.slice(0, 1).toUpperCase() + local.slice(1, 40);
    const user = await upsertUser({ email, name, provider: "email" });
    const session = await createSession(user.id);
    setSessionCookie(res, req, session);
    return redirect(res, "/?signedin=1");
  }
  if (verb !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  if (!rateLimit(`magic:${clientIp(req)}`, 8, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many sign-in emails from this network. Try again later." });
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Enter a work email." });
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!validEmail(email)) return sendJson(res, 400, { error: "Enter a valid work email." });
  if (!rateLimit(`magic-email:${email}`, 5, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many sign-in emails for that address. Try again later." });
  const token = await createMagic(email);
  const link = `${originOf(req)}/api/auth-magic?token=${encodeURIComponent(token)}`;
  const missing = missingEmailConfig();
  if (!missing.length) {
    try {
      await sendWithResend(email, link);
      return sendJson(res, 200, { ok: true, delivered: true, providers: providerFlags() });
    } catch (err) {
      return sendJson(res, 502, { error: err instanceof Error ? err.message : "The sign-in email could not be sent." });
    }
  }
  if (isLocalRequest(req)) {
    return sendJson(res, 200, {
      ok: true,
      delivered: false,
      devLink: link,
      missing,
      note: "Email delivery is not configured. This sign-in link is shown only on localhost.",
    });
  }
  return sendJson(res, 501, {
    error: "Magic links need RESEND_API_KEY and EMAIL_FROM on the server.",
    missing,
  });
}
