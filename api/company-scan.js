import { clientIp, cookies, method, rateLimit, readJson, sendJson } from "../lib/http.js";
import { advanceScan, createScan, viewScan } from "../lib/crawl.js";
import { readDoc, writeDoc } from "../lib/store.js";
import { userFromSessionToken } from "../lib/users.js";

const locks = new Map();

async function withLock(id, fn) {
  const previous = locks.get(id) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(id, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(id) === current) locks.delete(id);
  }
}

export default async function handler(req, res) {
  const verb = method(req);
  const user = await userFromSessionToken(cookies(req).dr_session);
  if (!user) return sendJson(res, 401, { error: "Sign in before scanning a company." });
  if (!rateLimit(`scan:${user.id}`, 20, 60 * 60 * 1000)) return sendJson(res, 429, { error: "Too many company scans. Try again later." });
  try {
    if (verb === "POST") {
      const body = await readJson(req);
      const created = await createScan(body.url);
      if (created._state) {
        await writeDoc(`scans/${created._state.id}`, created._state);
        await writeDoc(`scans/${created._state.id}/owner`, { userId: user.id });
      }
      const { _state, ...view } = created;
      return sendJson(res, created.status === "error" ? 422 : 200, view);
    }
    if (verb === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const id = url.searchParams.get("id") || "";
      if (!id) return sendJson(res, 400, { error: "Missing scan id." });
      const owner = await readDoc(`scans/${id}/owner`);
      if (!owner || owner.userId !== user.id) return sendJson(res, 404, { error: "That scan was not found." });
      const view = await withLock(id, async () => {
        const state = await readDoc(`scans/${id}`);
        if (!state) return null;
        if (state.status === "running") await advanceScan(state, 3);
        await writeDoc(`scans/${id}`, state);
        return viewScan(state);
      });
      if (!view) return sendJson(res, 404, { error: "That scan was not found." });
      return sendJson(res, 200, view);
    }
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The scan could not be started.";
    return sendJson(res, 400, { error: message });
  }
}
