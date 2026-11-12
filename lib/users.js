import { newId, cleanText, looksLikeUrl } from "./http.js";
import { deleteDoc, readDoc, writeDoc } from "./store.js";

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const MAGIC_MS = 1000 * 60 * 30;

const LINK_KEYS = [
  "website",
  "docs",
  "apiReference",
  "developerPortal",
  "github",
  "community",
  "blog",
  "changelog",
  "status",
  "pricing",
];

export function providerFlags() {
  return {
    github: Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()),
    google: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    email: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()),
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    avatarUrl: user.avatarUrl || "",
  };
}

function emailKey(email) {
  return `email/${encodeURIComponent(String(email).trim().toLowerCase())}`;
}

export async function findUserByEmail(email) {
  const row = await readDoc(emailKey(email));
  if (!row?.userId) return null;
  return readDoc(`users/${row.userId}`);
}

export async function upsertUser({ email, name, avatarUrl, provider, providerId }) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) throw new Error("An email address is required.");
  const existing = await findUserByEmail(normalized);
  const now = new Date().toISOString();
  const user = existing || {
    id: newId(12),
    email: normalized,
    name: "",
    avatarUrl: "",
    providers: {},
    createdAt: now,
  };
  if (name && !user.name) user.name = cleanText(name, 80);
  if (name && provider !== "email") user.name = cleanText(name, 80) || user.name;
  if (avatarUrl) user.avatarUrl = avatarUrl;
  user.providers = user.providers || {};
  if (provider) user.providers[provider] = providerId || true;
  user.updatedAt = now;
  await writeDoc(`users/${user.id}`, user);
  await writeDoc(emailKey(normalized), { userId: user.id });
  const index = await readDoc(`users/${user.id}/index`);
  if (!index) await writeDoc(`users/${user.id}/index`, { companyIds: [], activeCompanyId: null });
  return user;
}

export async function createSession(userId) {
  const token = newId(24);
  await writeDoc(`sessions/${token}`, { userId, expiresAt: Date.now() + SESSION_MS });
  return token;
}

export async function userFromSessionToken(token) {
  if (!token) return null;
  const session = await readDoc(`sessions/${token}`);
  if (!session || session.expiresAt < Date.now()) return null;
  return readDoc(`users/${session.userId}`);
}

export async function destroySession(token) {
  if (token) await deleteDoc(`sessions/${token}`);
}

export async function createMagic(email) {
  const token = newId(24);
  await writeDoc(`magic/${token}`, {
    email: String(email).trim().toLowerCase(),
    expiresAt: Date.now() + MAGIC_MS,
  });
  return token;
}

export async function consumeMagic(token) {
  const row = await readDoc(`magic/${token}`);
  if (!row) return null;
  await deleteDoc(`magic/${token}`);
  if (row.expiresAt < Date.now()) return null;
  return row.email;
}

export async function saveOauthState(state, payload) {
  await writeDoc(`oauth/${state}`, { ...payload, expiresAt: Date.now() + 1000 * 60 * 15 });
}

export async function takeOauthState(state) {
  const row = await readDoc(`oauth/${state}`);
  if (row) await deleteDoc(`oauth/${state}`);
  if (!row || row.expiresAt < Date.now()) return null;
  return row;
}

function emptyLinks() {
  return Object.fromEntries(LINK_KEYS.map((key) => [key, ""]));
}

export function normalizeProfile(input, { requireWebsite = true } = {}) {
  const links = emptyLinks();
  const source = input?.links && typeof input.links === "object" ? input.links : {};
  for (const key of LINK_KEYS) {
    const value = cleanText(source[key] ?? input?.[key], 300);
    if (!value) continue;
    if (!looksLikeUrl(value)) {
      const label = key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
      throw new Error(`Enter a full URL for ${label}.`);
    }
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    links[key] = url.toString();
  }
  if (requireWebsite && !links.website) throw new Error("A website is required.");
  let domain = cleanText(input?.domain, 120);
  if (links.website) {
    domain = new URL(links.website).hostname.replace(/^www\./, "");
  }
  const name = cleanText(input?.name, 80);
  if (!name) throw new Error("A company name is required.");
  return {
    name,
    domain,
    description: cleanText(input?.description, 200),
    logoUrl: looksLikeUrl(input?.logoUrl || "") ? cleanText(input.logoUrl, 400) : "",
    market: cleanText(input?.market, 120) || `Developers who use ${name}`,
    links,
  };
}

async function indexOf(userId) {
  return (await readDoc(`users/${userId}/index`)) || { companyIds: [], activeCompanyId: null };
}

export async function listCompanies(userId) {
  const index = await indexOf(userId);
  const companies = [];
  for (const id of index.companyIds || []) {
    const company = await readDoc(`users/${userId}/companies/${id}`);
    if (company) companies.push(company);
  }
  const active = companies.find((company) => company.id === index.activeCompanyId) || null;
  return { companies, activeCompany: active };
}

export async function createCompany(userId, profile) {
  const normalized = normalizeProfile(profile);
  const now = new Date().toISOString();
  const company = {
    id: newId(12),
    userId,
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  const index = await indexOf(userId);
  index.companyIds = [...(index.companyIds || []), company.id];
  index.activeCompanyId = company.id;
  await writeDoc(`users/${userId}/companies/${company.id}`, company);
  await writeDoc(`users/${userId}/index`, index);
  return company;
}

export async function updateCompany(userId, id, profile) {
  const current = await readDoc(`users/${userId}/companies/${id}`);
  if (!current) return null;
  const normalized = normalizeProfile({ ...current, ...profile, links: { ...current.links, ...(profile.links || {}) } });
  const company = { ...current, ...normalized, updatedAt: new Date().toISOString() };
  await writeDoc(`users/${userId}/companies/${id}`, company);
  return company;
}

export async function setActiveCompany(userId, id) {
  const index = await indexOf(userId);
  if (!(index.companyIds || []).includes(id)) return null;
  index.activeCompanyId = id;
  await writeDoc(`users/${userId}/index`, index);
  return readDoc(`users/${userId}/companies/${id}`);
}

export async function removeCompany(userId, id) {
  const index = await indexOf(userId);
  const companyIds = (index.companyIds || []).filter((item) => item !== id);
  if (companyIds.length === (index.companyIds || []).length) return null;
  await deleteDoc(`users/${userId}/companies/${id}`);
  await deleteDoc(`plans/${id}`);
  index.companyIds = companyIds;
  if (index.activeCompanyId === id) index.activeCompanyId = companyIds[0] || null;
  await writeDoc(`users/${userId}/index`, index);
  return listCompanies(userId);
}

export async function getPlan(companyId) {
  const row = await readDoc(`plans/${companyId}`);
  return row?.items || [];
}

export async function addPlanItem(userId, companyId, event) {
  const company = await readDoc(`users/${userId}/companies/${companyId}`);
  if (!company) return null;
  const items = await getPlan(companyId);
  if (items.some((item) => item.event?.id === event.id)) {
    return items;
  }
  items.push({ id: newId(8), addedAt: new Date().toISOString(), event });
  await writeDoc(`plans/${companyId}`, { items });
  return items;
}

export async function removePlanItem(userId, companyId, eventId) {
  const company = await readDoc(`users/${userId}/companies/${companyId}`);
  if (!company) return null;
  const items = (await getPlan(companyId)).filter((item) => item.event?.id !== eventId && item.id !== eventId);
  await writeDoc(`plans/${companyId}`, { items });
  return items;
}

export async function addWaitlist(email, app) {
  const row = (await readDoc("waitlist/entries")) || { entries: [] };
  const normalized = String(email).trim().toLowerCase();
  const existing = row.entries.find((entry) => entry.email === normalized && entry.app === app);
  if (existing) return { created: false, entry: existing };
  const entry = { id: newId(8), email: normalized, app, createdAt: new Date().toISOString() };
  row.entries.push(entry);
  await writeDoc("waitlist/entries", row);
  return { created: true, entry };
}
