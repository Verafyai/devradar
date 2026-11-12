import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Readable } from "node:stream";
import { isPrivateAddress, parseRobots, robotsAllows, classifyLink, createScan, USER_AGENT } from "../lib/crawl.js";
import { rankEvents, loadConferences, parsePlace } from "../lib/events.js";
import { readDoc, writeDoc } from "../lib/store.js";

test("private addresses are blocked", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("10.1.2.3"), true);
  assert.equal(isPrivateAddress("192.168.0.5"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("::1"), true);
});

test("robots.txt prefers the longest matching rule", () => {
  const groups = parseRobots(`User-agent: *\nDisallow: /\nAllow: /docs\n\nUser-agent: DevRadar\nDisallow: /private\nAllow: /private/open`);
  assert.equal(robotsAllows(groups, "/docs", USER_AGENT), true);
  assert.equal(robotsAllows(groups, "/private/open", USER_AGENT), true);
  assert.equal(robotsAllows(groups, "/private/nope", USER_AGENT), false);
  assert.equal(robotsAllows(groups, "/", USER_AGENT), true);
  const blocked = parseRobots("User-agent: DevRadar\nDisallow: /");
  assert.equal(robotsAllows(blocked, "/", USER_AGENT), false);
});

test("link classification", () => {
  assert.equal(classifyLink(new URL("https://github.com/acme/app")), "github");
  assert.equal(classifyLink(new URL("https://docs.acme.com/guide")), "docs");
  assert.equal(classifyLink(new URL("https://acme.com/pricing")), "pricing");
  assert.equal(classifyLink(new URL("https://discord.gg/acme")), "community");
  assert.equal(classifyLink(new URL("https://acme.com/api/reference")), "apiReference");
});

test("event ranking prefers a New York AI event inside the window", async () => {
  const events = await loadConferences();
  assert.ok(events.length > 50);
  const ranked = rankEvents(events, { market: "AI application developers", location: "New York, NY · 50 mi", months: 3 }, new Date("2026-10-30T15:00:00Z"));
  assert.ok(ranked.length > 0);
  assert.ok(ranked[0].fit >= ranked.at(-1).fit);
  assert.ok(ranked[0].fit >= 70);
  assert.match(`${ranked[0].name} ${ranked[0].location}`, /new york|brooklyn|ai/i);
  assert.ok(ranked.some((event) => /new york|brooklyn/i.test(event.location)));
  assert.ok(ranked.every((event) => event.startDate >= "2026-10-30" || event.endDate >= "2026-10-30"));
  const online = rankEvents(events, { market: "JavaScript", location: "Online", months: 6 }, new Date("2026-10-30T15:00:00Z"));
  assert.ok(online.length > 0);
  assert.equal(parsePlace("Online").online, true);
});

test("file store round trip", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "devradar-"));
  process.env.DEVRADAR_DATA_DIR = dir;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  await writeDoc("tests/sample", { ok: true });
  assert.deepEqual(await readDoc("tests/sample"), { ok: true });
  await rm(dir, { recursive: true, force: true });
});

test("example.com company scan reads the landing page", async () => {
  const result = await createScan("https://example.com");
  const state = result._state;
  assert.ok(state, result.error || "missing state");
  assert.equal(state.pagesRead >= 1, true);
  assert.match(state.profile.links.website, /example\.com/);
  assert.equal(state.profile.name.length > 0, true);
});

function mockReq(method, url, body, cookie = "") {
  const stream = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = { host: "127.0.0.1:43123", "content-type": "application/json", cookie };
  return stream;
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body || ""; },
  };
}

test("magic link sign-in, company save, switch and remove", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "devradar-auth-"));
  process.env.DEVRADAR_DATA_DIR = dir;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.RESEND_API_KEY;
  const magic = (await import("../api/auth-magic.js")).default;
  const companies = (await import("../api/companies.js")).default;
  const sessionApi = (await import("../api/session.js")).default;
  const req = mockReq("POST", "/api/auth-magic", { email: "ada@example.com" });
  const res = mockRes();
  await magic(req, res);
  const sent = JSON.parse(res.body);
  assert.equal(sent.delivered, false);
  assert.ok(sent.devLink);
  const token = new URL(sent.devLink).searchParams.get("token");
  const verifyReq = mockReq("GET", `/api/auth-magic?token=${token}`);
  const verifyRes = mockRes();
  await magic(verifyReq, verifyRes);
  assert.equal(verifyRes.statusCode, 302);
  const cookie = verifyRes.headers["set-cookie"];
  assert.match(cookie, /dr_session=/);
  const sessionReq = mockReq("GET", "/api/session", null, cookie.split(";")[0]);
  const sessionRes = mockRes();
  await sessionApi(sessionReq, sessionRes);
  const session = JSON.parse(sessionRes.body);
  assert.equal(session.user.email, "ada@example.com");
  const saveReq = mockReq("POST", "/api/companies", {
    name: "Example",
    description: "A public example company",
    market: "Application developers",
    links: { website: "https://example.com" },
  }, cookie.split(";")[0]);
  const saveRes = mockRes();
  await companies(saveReq, saveRes);
  const saved = JSON.parse(saveRes.body);
  assert.equal(saved.activeCompany.name, "Example");
  const secondReq = mockReq("POST", "/api/companies", {
    name: "Other",
    links: { website: "https://example.org" },
  }, cookie.split(";")[0]);
  const secondRes = mockRes();
  await companies(secondReq, secondRes);
  const both = JSON.parse(secondRes.body);
  assert.equal(both.companies.length, 2);
  assert.equal(both.activeCompany.name, "Other");
  const switchReq = mockReq("PATCH", "/api/companies", { id: saved.company.id, active: true }, cookie.split(";")[0]);
  const switchRes = mockRes();
  await companies(switchReq, switchRes);
  assert.equal(JSON.parse(switchRes.body).activeCompany.name, "Example");
  const removeReq = mockReq("DELETE", `/api/companies?id=${saved.company.id}`, null, cookie.split(";")[0]);
  const removeRes = mockRes();
  await companies(removeReq, removeRes);
  const left = JSON.parse(removeRes.body);
  assert.equal(left.companies.length, 1);
  assert.equal(left.activeCompany.name, "Other");
  await rm(dir, { recursive: true, force: true });
});
