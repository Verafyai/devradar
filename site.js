const LINKS = [
  ["website", "Website"],
  ["docs", "Docs"],
  ["apiReference", "API reference"],
  ["developerPortal", "Developer portal"],
  ["github", "GitHub"],
  ["community", "Community"],
  ["blog", "Blog"],
  ["changelog", "Changelog"],
  ["status", "Status"],
  ["pricing", "Pricing"],
];

const COLORS = ["#E07A3D", "#5B8DEF", "#5CD68C", "#F2B45C", "#F28FB0", "#9C8CFF", "#4FD1D9", "#FF8A6B"];
const DRAFT_KEY = "devradar.onboarding";

let session = { user: null, companies: [], activeCompany: null, providers: {} };
let draft = null;
let scanGen = 0;
let elapsedTimer = null;
let removeTarget = null;

const githubIcon = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
const googleIcon = `<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#EA4335" d="M9 7.2v3.5h4.9c-.2 1.2-1.6 3.6-4.9 3.6A5.7 5.7 0 1 1 9 3.3c1.6 0 2.7.7 3.3 1.3l2.2-2.2C13.2.9 11.3 0 9 0 4 0 0 4 0 9s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6 0-1-.1-1.5H9z"/><path fill="#34A853" d="M0 9c0 1.6.4 3.1 1.2 4.4l3.2-2.5A5.4 5.4 0 0 1 3.6 9c0-.7.1-1.3.3-1.9L.7 4.5A9 9 0 0 0 0 9z"/><path fill="#4285F4" d="M9 18c2.4 0 4.4-.8 5.9-2.2l-2.8-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8L.7 13.2A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M17.6 9.3c0-.6 0-1-.1-1.5H9v3.5h4.9c-.2 1.1-.8 2-1.6 2.7l2.8 2.2c1.6-1.5 2.5-3.7 2.5-6.9z"/></svg>`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function looksLikeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function colorFor(name) {
  let hash = 0;
  for (const char of String(name || "?")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function avatarHtml(name, logoUrl, large = false) {
  const cls = large ? "avatar-lg" : "avatar";
  const letter = escapeHtml((name || "?").slice(0, 1).toUpperCase());
  if (logoUrl) return `<span class="${cls}" style="background:${colorFor(name)}"><img src="${escapeHtml(logoUrl)}" alt="" onerror="this.replaceWith(document.createTextNode('${letter}'))"></span>`;
  return `<span class="${cls}" style="background:${colorFor(name)}">${letter}</span>`;
}

function displayUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return (url.hostname.replace(/^www\./, "") + (url.pathname === "/" ? "" : url.pathname)).replace(/\/$/, "");
  } catch {
    return value;
  }
}

async function api(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && data.status !== "error") throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function loadDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}
function saveDraft() {
  if (!draft) sessionStorage.removeItem(DRAFT_KEY);
  else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
function clearDraft() {
  draft = null;
  sessionStorage.removeItem(DRAFT_KEY);
}

function ensureChrome() {
  if (!document.querySelector("#flash")) {
    const flash = document.createElement("div");
    flash.id = "flash";
    flash.className = "shell flash";
    flash.hidden = true;
    document.body.insertBefore(flash, document.querySelector("main") || document.body.firstChild);
  }
  if (!document.querySelector("#modal-root")) {
    const root = document.createElement("div");
    root.id = "modal-root";
    root.className = "overlay";
    root.hidden = true;
    root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div id="modal-card"></div></div>`;
    document.body.append(root);
  }
  if (!document.querySelector("#confirm-root")) {
    const root = document.createElement("div");
    root.id = "confirm-root";
    root.className = "overlay";
    root.hidden = true;
    root.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><h2 id="confirm-title">Remove this company?</h2><p id="confirm-copy"></p><div class="dialog-actions"><button class="btn btn-outline" type="button" data-action="cancel-remove">Cancel</button><button class="btn btn-danger" type="button" data-action="confirm-remove">Remove</button></div></div>`;
    document.body.append(root);
  }
}

function showFlash(message) {
  const flash = document.querySelector("#flash");
  if (!flash) return;
  if (!message) { flash.hidden = true; flash.innerHTML = ""; return; }
  flash.hidden = false;
  flash.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function renderAccount() {
  const slot = document.querySelector("#account-slot");
  if (!slot) return;
  if (!session.user) {
    slot.innerHTML = `<button class="btn btn-outline" type="button" data-action="sign-in">Sign in</button>`;
    return;
  }
  const company = session.activeCompany;
  const pill = company
    ? `<button class="company-pill" type="button" data-action="toggle-companies" aria-expanded="false" aria-haspopup="menu">${avatarHtml(company.name, company.logoUrl)}<span class="pill-domain">${escapeHtml(company.domain || displayUrl(company.links?.website))}</span><svg class="caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>`
    : `<button class="btn btn-outline" type="button" data-action="add-company">Add a company</button>`;
  slot.innerHTML = `${pill}
    <div class="menu company-menu" id="company-menu" hidden></div>
    <button class="user-pill" type="button" data-action="toggle-user" aria-label="Account menu">${escapeHtml(initials(session.user.name, session.user.email))}</button>
    <div class="menu user-menu" id="user-menu" hidden>
      <p class="menu-email">${escapeHtml(session.user.email)}</p>
      <a href="/companies">Manage companies</a>
      <button type="button" data-action="sign-out">Sign out</button>
    </div>`;
  renderCompanyMenu();
}

function renderCompanyMenu() {
  const menu = document.querySelector("#company-menu");
  if (!menu) return;
  const activeId = session.activeCompany?.id;
  const rows = (session.companies || []).map((company) => `<button type="button" data-action="switch-company" data-id="${escapeHtml(company.id)}">${avatarHtml(company.name, company.logoUrl)}<span>${escapeHtml(company.name)}</span>${company.id === activeId ? `<span class="check" aria-label="Active">✓</span>` : ""}</button>`).join("");
  const name = session.activeCompany?.name || "company";
  menu.innerHTML = `<p class="menu-label">Your companies</p>${rows || `<p class="menu-email">No companies yet.</p>`}
    <button type="button" data-action="add-company">+ Add a company</button>
    ${session.activeCompany ? `<button type="button" data-action="edit-company">Edit ${escapeHtml(name)}'s profile</button><button type="button" class="danger" data-action="ask-remove">Remove ${escapeHtml(name)}</button>` : ""}`;
}

function renderHero() {
  const slot = document.querySelector("#hero-action");
  if (!slot) return;
  const company = session.activeCompany;
  if (session.user && company) {
    slot.innerHTML = `<form id="hero-form" class="hero-form">
      <div class="hero-chip">${avatarHtml(company.name, company.logoUrl)}<span class="chip-name">${escapeHtml(company.name)}</span><span class="chip-domain">${escapeHtml(company.domain || "")}</span></div>
      <button class="btn-primary btn-lg" id="hero-submit" type="submit">Run Deep Scan</button>
    </form>
    <p class="hint">Your company is pinned. Every app below starts from ${escapeHtml(company.name)}'s profile. Switch or add companies from the menu up top.</p>
    <p class="hero-error" id="hero-error" hidden></p>`;
    return;
  }
  slot.innerHTML = `<form id="hero-form" class="hero-form">
      <input class="field" id="hero-url" name="url" placeholder="yourcompany.com" aria-label="Company website" autocomplete="url" autocapitalize="off" spellcheck="false">
      <button class="btn-primary btn-lg" id="hero-submit" type="submit" disabled>Scan your company</button>
    </form>
    <p class="hint">Sign in to save your company. Takes about 90 seconds. · Search powered by Bright Data</p>
    <p class="hero-error" id="hero-error" hidden></p>`;
}

function applyProfile() {
  const company = session.activeCompany;
  document.querySelectorAll("[data-profile-line]").forEach((node) => {
    const template = company ? node.dataset.signedIn : node.dataset.signedOut;
    if (template) node.textContent = template.replaceAll("{name}", company?.name || "your company");
  });
  document.querySelectorAll("[data-prefill]").forEach((input) => {
    if (input.dataset.filled === "1" || input.value) return;
    if (!company) return;
    if (input.dataset.prefill === "market") input.value = company.market || "";
    if (input.dataset.prefill === "docs") input.value = company.links?.docs || company.links?.website || "";
    input.dataset.filled = "1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const root = document.querySelector("#companies-root");
  if (root) renderCompanies(root);
}

function renderCompanies(root) {
  if (!session.user) {
    root.innerHTML = `<p class="lede">Sign in to see the companies on your profile.</p><button class="btn-primary" type="button" data-action="sign-in">Sign in</button>`;
    return;
  }
  if (!session.companies.length) {
    root.innerHTML = `<p class="lede">No companies yet. Add one and every app starts from that profile.</p><button class="btn-primary" type="button" data-action="add-company">Add a company</button>`;
    return;
  }
  root.innerHTML = `<div class="company-list">${session.companies.map((company) => `<article class="company-row panel">
      <div class="who">${avatarHtml(company.name, company.logoUrl, true)}<div><p><strong>${escapeHtml(company.name)}</strong> ${company.id === session.activeCompany?.id ? `<span class="pill pill-live">Active</span>` : ""}</p><p class="hint">${escapeHtml(company.domain || "")}</p></div></div>
      <div class="row-actions">
        ${company.id === session.activeCompany?.id ? "" : `<button class="btn btn-outline" type="button" data-action="switch-company" data-id="${escapeHtml(company.id)}">Make active</button>`}
        <button class="btn btn-outline" type="button" data-action="edit-company" data-id="${escapeHtml(company.id)}">Edit</button>
        <button class="btn btn-danger" type="button" data-action="ask-remove" data-id="${escapeHtml(company.id)}">Remove</button>
      </div>
    </article>`).join("")}</div>
    <p style="margin-top:18px"><button class="btn-primary" type="button" data-action="add-company">Add a company</button></p>`;
}

function openModal(next) {
  draft = next;
  saveDraft();
  const root = document.querySelector("#modal-root");
  root.hidden = false;
  renderModal(true);
  const focus = root.querySelector("input, button");
  focus?.focus();
}

function closeModal() {
  scanGen += 1;
  stopElapsed();
  const root = document.querySelector("#modal-root");
  if (root) root.hidden = true;
}

function emptyProfile(url = "") {
  const links = Object.fromEntries(LINKS.map(([key]) => [key, ""]));
  if (url) links.website = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return { name: "", description: "", logoUrl: "", domain: "", market: "", links };
}

function renderModal(force = false) {
  const card = document.querySelector("#modal-card");
  if (!card || !draft) return;
  if (!force && card.dataset.step === String(draft.step) && draft.step !== 3) {
    syncModal();
    return;
  }
  card.dataset.step = String(draft.step);
  card.innerHTML = modalHtml();
  syncModal();
  if (draft.step === 3 && draft.view?.startedAt) startElapsed(draft.view.startedAt);
}

function modalHtml() {
  if (draft.step === 1) {
    return `<p class="eyebrow">Step 1 · Sign in</p>
      <h2 id="modal-title">Sign in to DevRadar</h2>
      <p class="sub">Save your company once, and every app starts from it.</p>
      <div class="stack">
        <button class="btn btn-outline btn-block oauth" type="button" data-action="oauth-github">${githubIcon} Continue with GitHub</button>
        <p class="provider-note" id="github-note" hidden></p>
        <button class="btn btn-outline btn-block oauth" type="button" data-action="oauth-google">${googleIcon} Continue with Google</button>
        <p class="provider-note" id="google-note" hidden></p>
        <div class="divider">or</div>
        <form id="magic-form" class="stack">
          <label>Work email<input class="field" id="auth-email" type="email" name="email" placeholder="you@company.com" autocomplete="email"></label>
          <button class="btn-primary btn-block" id="auth-email-submit" type="submit" disabled>Email me a sign-in link</button>
        </form>
        <p class="provider-note" id="magic-note" hidden></p>
        <p class="fine">No password. We'll never post anything on your behalf.</p>
      </div>`;
  }
  if (draft.step === 2) {
    return `<p class="eyebrow">Step 2 · Tell us about your company</p>
      <h2 id="modal-title">Tell us about your company</h2>
      <p class="sub">Paste your landing page. We'll find your docs, API reference, GitHub and community on our own.</p>
      <form id="company-url-form" class="stack">
        <label>Your landing page<input class="field" id="company-url" value="${escapeHtml(draft.url || "")}" placeholder="https://www.example.com" autocomplete="url"></label>
        <p class="fine good" id="url-good" hidden>Looks like a company website</p>
        <p class="provider-note" id="url-error" ${draft.error ? "" : "hidden"}>${escapeHtml(draft.error || "")}</p>
        <button class="btn-primary btn-block" id="company-url-submit" type="submit" disabled>Scan my company</button>
      </form>
      <p class="fine">You can add more companies or edit anything later.</p>`;
  }
  if (draft.step === 3) {
    const view = draft.view;
    const failed = draft.error || view?.status === "error";
    const steps = view?.steps || [
      { id: "landing", label: "Reading the landing page", status: "active", count: "" },
      { id: "docs", label: "Finding docs, API and developer portal", status: "pending", count: "" },
      { id: "links", label: "Collecting links: GitHub, community, blog", status: "pending", count: "" },
      { id: "profile", label: "Building your company profile", status: "pending", count: "" },
    ];
    const done = steps.filter((step) => step.status === "done").length;
    const width = Math.round((done / steps.length) * 100);
    return `<p class="eyebrow">Step 3 · Scanning</p>
      <h2 id="modal-title">Scanning ${escapeHtml(displayUrl(draft.url) || "your company")}...</h2>
      <p class="sub">${failed ? escapeHtml(draft.error || view?.error || "The scan did not finish.") : "About 60 to 90 seconds. Keep this window open or come back later."}</p>
      <ul class="progress-list">${steps.map((step) => `<li>${mark(step.status)}<span>${escapeHtml(step.label)}</span><span class="count">${escapeHtml(step.count || "")}</span></li>`).join("")}</ul>
      <div class="bar" aria-hidden="true"><span style="width:${width}%"></span></div>
      <p class="fine" id="scan-elapsed"></p>
      ${failed ? `<div class="modal-actions"><button class="btn btn-outline" type="button" data-action="manual-links">Enter links manually</button><button class="btn-primary" type="button" data-action="retry-scan">Try again</button></div>` : ""}`;
  }
  const profile = draft.profile || emptyProfile(draft.url);
  const editingBrand = draft.editing === "brand";
  return `<p class="eyebrow">Step 4 · Confirm and save</p>
    <h2 id="modal-title">Is this your company?</h2>
    <p class="sub">Check what we found. Fix anything that's wrong, then save it to your profile.</p>
    <div class="brand-card">
      ${avatarHtml(profile.name || profile.domain || "?", profile.logoUrl, true)}
      <div style="flex:1">
        ${editingBrand
          ? `<label>Name<input class="field" id="brand-name" value="${escapeHtml(profile.name || "")}"></label>
             <label style="margin-top:8px">Description<input class="field" id="brand-description" value="${escapeHtml(profile.description || "")}"></label>`
          : `<h3>${escapeHtml(profile.name || "Untitled company")}</h3><p>${escapeHtml(profile.description || "Add a one-line description.")}</p>`}
      </div>
      <button class="edit" type="button" data-action="edit-brand">${editingBrand ? "Done" : "Edit"}</button>
    </div>
    <div class="link-list">${LINKS.map(([key, label]) => linkRow(key, label, profile)).join("")}</div>
    <p class="provider-note" id="save-error" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-outline" type="button" data-action="not-my-company">Not my company</button>
      <button class="btn-primary" id="save-company" type="button" data-action="save-company" disabled>Save to my profile</button>
    </div>`;
}

function linkRow(key, label, profile) {
  const value = profile.links?.[key] || "";
  if (draft.editing === key) {
    return `<div class="link-row"><span>${label}</span><input class="field" data-link="${key}" value="${escapeHtml(value)}" placeholder="https://"></div>`;
  }
  if (!value) return `<div class="link-row"><span>${label}</span><button class="linkish" type="button" data-action="edit-link" data-key="${key}">+ Add</button><span></span></div>`;
  return `<div class="link-row"><span>${label}</span><code>${escapeHtml(displayUrl(value))}</code><button class="linkish" type="button" data-action="edit-link" data-key="${key}">Edit</button></div>`;
}

function mark(status) {
  if (status === "done") return `<svg class="mark" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="#5CD68C" stroke-width="1.8"/><path d="M6 10.2l2.4 2.4L14 7.5" fill="none" stroke="#5CD68C" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  if (status === "active") return `<svg class="mark spin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="#2D3845" stroke-width="1.8"/><path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="#5CD68C" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  if (status === "error") return `<svg class="mark" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="#FF8A6B" stroke-width="1.8"/></svg>`;
  return `<svg class="mark" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="#2D3845" stroke-width="1.8"/></svg>`;
}

function syncModal() {
  const email = document.querySelector("#auth-email");
  const emailButton = document.querySelector("#auth-email-submit");
  if (email && emailButton) emailButton.disabled = !validEmail(email.value);
  const url = document.querySelector("#company-url");
  const urlButton = document.querySelector("#company-url-submit");
  const good = document.querySelector("#url-good");
  if (url && urlButton) {
    const ok = looksLikeUrl(url.value);
    urlButton.disabled = !ok;
    url.classList.toggle("good", ok);
    if (good) good.hidden = !ok;
  }
  const save = document.querySelector("#save-company");
  if (save && draft?.profile) save.disabled = !draft.profile.name?.trim() || !looksLikeUrl(draft.profile.links?.website || "");
}

function startElapsed(startedAt) {
  stopElapsed();
  const tick = () => {
    const node = document.querySelector("#scan-elapsed");
    if (!node) return;
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    node.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} elapsed`;
  };
  tick();
  elapsedTimer = setInterval(tick, 1000);
}
function stopElapsed() {
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function pollScan(startView) {
  const gen = ++scanGen;
  let view = startView;
  while (view?.status === "running" && gen === scanGen) {
    draft.view = view;
    draft.step = 3;
    saveDraft();
    renderModal(true);
    await sleep(650);
    if (gen !== scanGen) return;
    view = await api(`/api/company-scan?id=${encodeURIComponent(view.id)}`);
  }
  if (gen !== scanGen || !view) return;
  draft.view = view;
  if (view.status === "error") {
    draft.error = view.error || "The scan failed.";
    draft.step = 3;
  } else {
    draft.profile = view.profile;
    draft.error = "";
    draft.step = 4;
    draft.editing = "";
  }
  saveDraft();
  renderModal(true);
}

async function beginScan(url) {
  draft.url = url;
  draft.step = 3;
  draft.error = "";
  draft.view = null;
  saveDraft();
  renderModal(true);
  const view = await api("/api/company-scan", { method: "POST", body: { url } });
  if (view.status === "error") {
    draft.error = view.error || "The scan failed.";
    draft.step = 3;
    saveDraft();
    renderModal(true);
    return;
  }
  draft.scanId = view.id;
  await pollScan(view);
}

async function refreshSession() {
  session = await api("/api/session");
  renderAccount();
  renderHero();
  applyProfile();
}

async function runDeepScan(url) {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.reportUrl) throw new Error(data.error || "The scan could not be started.");
  location.href = data.reportUrl;
}

function setNote(id, message) {
  const node = document.querySelector(id);
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
}

async function startOauth(provider) {
  const check = await api(`/api/auth-${provider}?check=1`);
  if (!check.configured) {
    const missing = (check.missing || []).join(" and ");
    setNote(`#${provider}-note`, `${provider === "github" ? "GitHub" : "Google"} sign-in needs ${missing} on the server.`);
    return;
  }
  if (draft) saveDraft();
  location.href = `/api/auth-${provider}`;
}

function currentCompany(id) {
  return (session.companies || []).find((company) => company.id === (id || session.activeCompany?.id)) || null;
}

async function onClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) {
    if (!event.target.closest(".menu") && !event.target.closest(".company-pill") && !event.target.closest(".user-pill")) {
      document.querySelectorAll(".menu").forEach((menu) => { menu.hidden = true; });
    }
    return;
  }
  const action = trigger.dataset.action;
  if (action === "sign-in") {
    const saved = loadDraft();
    if (saved && session.user && saved.step > 1) openModal(saved);
    else if (saved && !session.user) openModal({ ...saved, step: 1 });
    else openModal({ step: session.user ? 2 : 1, url: "", mode: "create", editing: "" });
  }
  if (action === "add-company") {
    document.querySelectorAll(".menu").forEach((menu) => { menu.hidden = true; });
    openModal({ step: 2, url: "", mode: "create", editing: "", profile: emptyProfile() });
  }
  if (action === "toggle-companies") {
    const menu = document.querySelector("#company-menu");
    const userMenu = document.querySelector("#user-menu");
    if (userMenu) userMenu.hidden = true;
    menu.hidden = !menu.hidden;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
  }
  if (action === "toggle-user") {
    const menu = document.querySelector("#user-menu");
    const companyMenu = document.querySelector("#company-menu");
    if (companyMenu) companyMenu.hidden = true;
    menu.hidden = !menu.hidden;
  }
  if (action === "sign-out") {
    await api("/api/auth-logout", { method: "POST", body: {} });
    clearDraft();
    await refreshSession();
    if (location.pathname === "/companies") location.href = "/";
  }
  if (action === "switch-company") {
    await api("/api/companies", { method: "PATCH", body: { id: trigger.dataset.id, active: true } });
    await refreshSession();
    document.querySelectorAll(".menu").forEach((menu) => { menu.hidden = true; });
  }
  if (action === "edit-company") {
    const company = currentCompany(trigger.dataset.id);
    document.querySelectorAll(".menu").forEach((menu) => { menu.hidden = true; });
    if (!company) return;
    openModal({ step: 4, mode: "edit", editId: company.id, url: company.links?.website || "", profile: structuredClone(company), editing: "" });
  }
  if (action === "ask-remove") {
    removeTarget = currentCompany(trigger.dataset.id);
    document.querySelectorAll(".menu").forEach((menu) => { menu.hidden = true; });
    if (!removeTarget) return;
    document.querySelector("#confirm-title").textContent = `Remove ${removeTarget.name}?`;
    document.querySelector("#confirm-copy").textContent = "Apps will stop using this profile. The public company is unchanged, and anyone can add it again.";
    document.querySelector("#confirm-root [data-action='confirm-remove']").textContent = `Remove ${removeTarget.name}`;
    document.querySelector("#confirm-root").hidden = false;
  }
  if (action === "cancel-remove") document.querySelector("#confirm-root").hidden = true;
  if (action === "confirm-remove" && removeTarget) {
    await api(`/api/companies?id=${encodeURIComponent(removeTarget.id)}`, { method: "DELETE" });
    document.querySelector("#confirm-root").hidden = true;
    removeTarget = null;
    await refreshSession();
  }
  if (action === "oauth-github") await startOauth("github");
  if (action === "oauth-google") await startOauth("google");
  if (action === "retry-scan") await beginScan(draft.url);
  if (action === "manual-links") {
    draft.profile = draft.profile?.links?.website ? draft.profile : emptyProfile(draft.url);
    if (!draft.profile.links.website) draft.profile.links.website = /^https?:\/\//i.test(draft.url) ? draft.url : `https://${draft.url}`;
    try { draft.profile.domain = new URL(draft.profile.links.website).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    if (!draft.profile.name) draft.profile.name = draft.profile.domain?.split(".")[0] || "";
    draft.step = 4;
    draft.error = "";
    saveDraft();
    renderModal(true);
  }
  if (action === "not-my-company") {
    draft.step = 2;
    draft.profile = null;
    draft.view = null;
    saveDraft();
    renderModal(true);
  }
  if (action === "edit-brand") {
    draft.editing = draft.editing === "brand" ? "" : "brand";
    saveDraft();
    renderModal(true);
  }
  if (action === "edit-link") {
    draft.editing = trigger.dataset.key;
    saveDraft();
    renderModal(true);
    document.querySelector(`[data-link="${trigger.dataset.key}"]`)?.focus();
  }
  if (action === "save-company") await saveCompany();
}

async function saveCompany() {
  const button = document.querySelector("#save-company");
  const profile = draft.profile;
  if (button) button.disabled = true;
  try {
    if (draft.mode === "edit" && draft.editId) {
      await api("/api/companies", { method: "PATCH", body: { id: draft.editId, ...profile, links: profile.links } });
    } else {
      await api("/api/companies", { method: "POST", body: profile });
    }
    clearDraft();
    closeModal();
    await refreshSession();
  } catch (err) {
    setNote("#save-error", err.message);
    if (button) button.disabled = false;
  }
}

async function onSubmit(event) {
  const form = event.target;
  if (form.id === "hero-form") {
    event.preventDefault();
    const error = document.querySelector("#hero-error");
    if (error) error.hidden = true;
    if (session.user && session.activeCompany) {
      const url = session.activeCompany.links?.docs || session.activeCompany.links?.website;
      try { await runDeepScan(url); } catch (err) {
        if (error) { error.hidden = false; error.textContent = err.message; }
      }
      return;
    }
    const url = document.querySelector("#hero-url")?.value.trim();
    if (!looksLikeUrl(url)) return;
    openModal({ step: session.user ? 2 : 1, url, mode: "create", editing: "" });
  }
  if (form.id === "magic-form") {
    event.preventDefault();
    const email = document.querySelector("#auth-email").value.trim();
    const button = document.querySelector("#auth-email-submit");
    button.disabled = true;
    try {
      const result = await api("/api/auth-magic", { method: "POST", body: { email } });
      if (result.devLink) setNote("#magic-note", `Email delivery is not configured (${(result.missing || []).join(", ")}). Open this sign-in link: ${result.devLink}`);
      else setNote("#magic-note", "Check your inbox for a sign-in link. It expires in 30 minutes.");
      document.querySelector("#magic-note").style.color = "#C3CCD6";
    } catch (err) {
      setNote("#magic-note", err.message);
    }
  }
  if (form.id === "company-url-form") {
    event.preventDefault();
    const url = document.querySelector("#company-url").value.trim();
    if (!looksLikeUrl(url)) return;
    try { await beginScan(url); } catch (err) {
      draft.error = err.message;
      saveDraft();
      renderModal(true);
    }
  }
  if (form.id === "event-form") {
    event.preventDefault();
    await findEvents(form);
  }
  if (form.id === "deep-form") {
    event.preventDefault();
    const status = document.querySelector("#deep-status");
    const url = document.querySelector("#deep-url").value.trim();
    if (!looksLikeUrl(url)) return;
    status.hidden = false;
    status.textContent = "Starting the scan. This usually takes about 90 seconds.";
    try { await runDeepScan(url); } catch (err) { status.textContent = err.message; }
  }
  if (form.classList.contains("waitlist-form")) {
    event.preventDefault();
    const email = form.querySelector("input[type=email]").value.trim();
    const note = form.querySelector("[data-waitlist-note]");
    const button = form.querySelector("button");
    if (!validEmail(email)) return;
    button.disabled = true;
    try {
      const result = await api("/api/waitlist", { method: "POST", body: { email, app: form.dataset.app } });
      note.textContent = result.created ? `You're on the list. We'll email ${email} when this app opens.` : `You're already on the list for ${email}.`;
    } catch (err) {
      note.textContent = err.message;
      button.disabled = false;
    }
  }
}

function onInput(event) {
  const target = event.target;
  if (target.id === "hero-url") {
    const button = document.querySelector("#hero-submit");
    if (button) button.disabled = !looksLikeUrl(target.value);
  }
  if (target.id === "auth-email" || target.id === "company-url") {
    if (target.id === "company-url" && draft) draft.url = target.value.trim();
    syncModal();
    saveDraft();
  }
  if (target.id === "brand-name" || target.id === "brand-description") {
    draft.profile = draft.profile || emptyProfile(draft.url);
    if (target.id === "brand-name") draft.profile.name = target.value;
    if (target.id === "brand-description") draft.profile.description = target.value;
    saveDraft();
    syncModal();
  }
  if (target.dataset.link && draft?.profile) {
    draft.profile.links[target.dataset.link] = target.value.trim();
    if (target.dataset.link === "website") {
      try { draft.profile.domain = new URL(/^https?:\/\//i.test(target.value) ? target.value : `https://${target.value}`).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    }
    saveDraft();
    syncModal();
  }
  if (target.id === "deep-url") document.querySelector("#deep-submit").disabled = !looksLikeUrl(target.value);
  if (target.closest("#event-form")) syncEventButton();
  if (target.closest(".waitlist-form")) {
    const form = target.closest(".waitlist-form");
    form.querySelector("button").disabled = !validEmail(form.querySelector("input[type=email]").value);
  }
}

function syncEventButton() {
  const form = document.querySelector("#event-form");
  if (!form) return;
  const market = form.market.value.trim();
  const location = form.location.value.trim();
  const button = form.querySelector("button[type=submit]");
  button.disabled = !market || !location || !form.window.value;
}

async function findEvents(form) {
  const status = document.querySelector("#event-status");
  const results = document.querySelector("#event-results");
  status.hidden = false;
  status.textContent = "Searching the conference calendar and ranking by fit.";
  results.innerHTML = "";
  try {
    const data = await api("/api/events", {
      method: "POST",
      body: { market: form.market.value.trim(), location: form.location.value.trim(), window: Number(form.window.value) },
    });
    status.hidden = true;
    renderEvents(data);
  } catch (err) {
    status.textContent = err.message;
  }
}

function renderEvents(data) {
  const results = document.querySelector("#event-results");
  const events = data.events || [];
  if (!events.length) {
    results.innerHTML = `<p class="empty">No events in that window matched this market and location. Try a wider window, Online, or a broader market.</p>`;
    return;
  }
  const planned = new Set((window.__planItems || []).map((item) => item.event?.id));
  results.innerHTML = `<div class="results-head"><h2>${events.length} event${events.length === 1 ? "" : "s"} found</h2><p>${escapeHtml(data.note || "Ranked by fit with your market.")}</p></div>
    ${events.map((event) => `<article class="event-row">
      <div class="date-block"><span class="date-mon">${escapeHtml(event.month)}</span><span class="date-day">${escapeHtml(event.day)}</span></div>
      <div><h3><a href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">${escapeHtml(event.name)}</a></h3><p class="desc">${escapeHtml(event.description)}</p></div>
      <p class="where">${escapeHtml(event.location)}</p>
      <div class="fit"><strong>${event.fit}% fit</strong><span>${escapeHtml(event.action)}</span></div>
      <div class="add"><button class="btn btn-outline" type="button" data-action="add-plan" data-event="${escapeHtml(JSON.stringify(event))}" ${planned.has(event.id) ? "disabled" : ""}>${planned.has(event.id) ? "Added" : "Add to plan"}</button></div>
    </article>`).join("")}
    <div id="plan-block"></div>`;
  renderPlan();
}

function renderPlan() {
  const block = document.querySelector("#plan-block");
  const items = window.__planItems || [];
  if (!block || !items.length) return;
  block.innerHTML = `<div class="results-head"><h2>On your plan</h2><p>${items.length} saved for ${escapeHtml(session.activeCompany?.name || "this company")}</p></div>
    <ul class="plan-list">${items.map((item) => `<li class="panel" style="padding:12px 16px"><span>${escapeHtml(item.event.name)}</span><button class="btn btn-outline" type="button" data-action="remove-plan" data-id="${escapeHtml(item.event.id)}">Remove</button></li>`).join("")}</ul>`;
}

async function loadPlan() {
  if (!session.activeCompany || !document.querySelector("#event-form")) return;
  try {
    const data = await api(`/api/plan?companyId=${encodeURIComponent(session.activeCompany.id)}`);
    window.__planItems = data.items || [];
  } catch {
    window.__planItems = [];
  }
}

document.addEventListener("click", (event) => {
  const planButton = event.target.closest("[data-action='add-plan'], [data-action='remove-plan']");
  if (!planButton) return;
  event.preventDefault();
  if (planButton.dataset.action === "add-plan") addToPlan(planButton);
  else removeFromPlan(planButton.dataset.id);
});

async function addToPlan(button) {
  if (!session.user || !session.activeCompany) {
    openModal({ step: 1, url: "", mode: "create", editing: "" });
    return;
  }
  const event = JSON.parse(button.dataset.event);
  button.disabled = true;
  try {
    const data = await api("/api/plan", { method: "POST", body: { companyId: session.activeCompany.id, event } });
    window.__planItems = data.items || [];
    button.textContent = "Added";
    renderPlan();
  } catch (err) {
    button.disabled = false;
    showFlash(err.message);
  }
}

async function removeFromPlan(eventId) {
  const data = await api("/api/plan", { method: "DELETE", body: { companyId: session.activeCompany.id, eventId } });
  window.__planItems = data.items || [];
  document.querySelectorAll("[data-action='add-plan']").forEach((button) => {
    const event = JSON.parse(button.dataset.event);
    if (event.id === eventId) { button.disabled = false; button.textContent = "Add to plan"; }
  });
  renderPlan();
  const block = document.querySelector("#plan-block");
  if (block && !(window.__planItems || []).length) block.innerHTML = "";
}

document.addEventListener("click", (event) => { onClick(event).catch((err) => showFlash(err.message)); });
document.addEventListener("submit", (event) => { onSubmit(event).catch((err) => showFlash(err.message)); });
document.addEventListener("input", onInput);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    const confirm = document.querySelector("#confirm-root");
    if (confirm) confirm.hidden = true;
  }
});

async function boot() {
  ensureChrome();
  const params = new URLSearchParams(location.search);
  if (params.get("error")) showFlash(params.get("error"));
  if (params.get("auth_error")) showFlash(params.get("auth_error"));
  try {
    await refreshSession();
  } catch (err) {
    showFlash(err.message);
  }
  await loadPlan();
  syncEventButton();
  const saved = loadDraft();
  const returning = params.get("signedin") === "1";
  if (saved && returning) {
    if (session.user) saved.step = saved.url ? Math.max(saved.step, 2) : 2;
    if (session.user && saved.step === 1) saved.step = 2;
    openModal(saved);
  } else if (saved && session.user && saved.step === 3 && saved.scanId) {
    openModal(saved);
    const view = await api(`/api/company-scan?id=${encodeURIComponent(saved.scanId)}`).catch(() => null);
    if (view && view.status === "running") await pollScan(view);
    else if (view) await pollScan(view);
  }
}

boot();
