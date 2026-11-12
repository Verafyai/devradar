// DevRadar mechanical eval. Read-only: GET requests and headless page loads only.
// Usage: node mech.mjs <baseUrl> [--out DIR] [--shots]
// Writes <out>/mech.json and <out>/mech.md, and appends one row per page to ../scores/mech-history.csv.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const base = (process.argv[2] || 'https://devradar.rexstjohn.com').replace(/\/$/, '');
const outIdx = process.argv.indexOf('--out');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const out = outIdx > 0 ? process.argv[outIdx + 1] : path.resolve('out', stamp);
const shots = process.argv.includes('--shots');
fs.mkdirSync(out, { recursive: true });

const APPS = ['event-scanner','developer-profiler','social-trends','influencers','docs-scanner','looper','competition','deep-scan','ideas'];
const PAGES = [{ id: 'home', p: '/' }, { id: 'pricing', p: '/pricing' }, ...APPS.map(a => ({ id: a, p: `/apps/${a}`, app: true }))];
const WIDTHS = [375, 768, 1440];

async function fetchStatus(u) { try { const r = await fetch(u, { redirect: 'manual' }); return r.status; } catch { return 0; } }

const browser = await chromium.launch();
const results = [];
for (const pg of PAGES) {
  const url = base + pg.p;
  const r = { id: pg.id, url, checks: {} };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let resp;
  try { resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { r.error = String(e).slice(0, 200); }
  r.status = resp ? resp.status() : 0;
  const info = await page.evaluate(() => {
    const t = document.title || '';
    const md = document.querySelector('meta[name="description"]')?.content || '';
    const h1 = [...document.querySelectorAll('h1')].map(h => h.innerText.trim());
    const canon = document.querySelector('link[rel="canonical"]')?.href || '';
    const og = document.querySelector('meta[property="og:image"]')?.content || '';
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent);
    const txt = document.body?.innerText || '';
    const dashes = (txt.match(/[\u2013\u2014]/g) || []).length + (t + md).split('').filter(c => c === '\u2013' || c === '\u2014').length;
    let small = 0; const smallEx = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length) continue;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < 14) { small++; if (smallEx.length < 5) smallEx.push(`${fs}px: ${el.textContent.trim().slice(0, 40)}`); }
    }
    const runMeta = /About \d+ (seconds|minutes?)/i.test(txt);
    const soon = /\bSOON\b/.test(txt);
    return { t, md, h1, canon, og, ld, dashes, small, smallEx, runMeta, soon };
  }).catch(() => null);
  if (info) {
    Object.assign(r, { title: info.t, meta: info.md, h1: info.h1, smallEx: info.smallEx });
    const ldAll = info.ld.join(' ');
    const c = r.checks;
    c.http_200 = r.status === 200;
    c.title_50_60 = info.t.length >= 50 && info.t.length <= 60;
    c.title_not_generic = !/^[^|]{0,40}\s[·|-]\s?DevRadar$/.test(info.t) && info.t !== 'DevRadar';
    c.meta_140_155 = info.md.length >= 140 && info.md.length <= 155;
    c.one_h1 = info.h1.length === 1;
    c.canonical = !!info.canon;
    c.og_image = !!info.og;
    c.schema = pg.app ? /SoftwareApplication/.test(ldAll) : pg.id === 'home' ? /Organization/.test(ldAll) : info.ld.length > 0;
    c.no_dashes = info.dashes === 0;
    c.min_font_14 = info.small === 0;
    if (pg.app) c.run_meta_line = info.runMeta;
    r.small_text_nodes = info.small; r.dash_count = info.dashes;
  }
  try { await page.addScriptTag({ content: axeSrc });
    const ax = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length })));
    r.axe = ax; r.checks.axe_no_serious = !ax.some(v => v.impact === 'serious' || v.impact === 'critical');
  } catch (e) { r.axe_error = String(e).slice(0, 120); }
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(200);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    r.checks[`no_overflow_${w}`] = ov <= 1;
    if (shots) await page.screenshot({ path: path.join(out, `${pg.id}-${w}.png`), fullPage: true });
  }
  const vals = Object.values(r.checks);
  r.pass = vals.filter(Boolean).length; r.total = vals.length;
  r.score = (r.status === 200 && r.total) ? Math.round(1000 * r.pass / r.total) / 10 : 0;
  results.push(r);
  await ctx.close();
  console.log(`${pg.id.padEnd(20)} ${r.status} ${r.pass}/${r.total} ${r.score}`);
}
await browser.close();
const site = {
  sitemap: await fetchStatus(base + '/sitemap.xml'),
  robots: await fetchStatus(base + '/robots.txt'),
  llms: await fetchStatus(base + '/llms.txt'),
  plan: await fetchStatus(base + '/plan'),
  tools_agent_readiness: await fetchStatus(base + '/tools/agent-readiness'),
  events_directory: await fetchStatus(base + '/events'),
};
const overall = Math.round(10 * results.reduce((a, r) => a + r.score, 0) / results.length) / 10;
const summary = { base, at: new Date().toISOString(), overall, site, results };
fs.writeFileSync(path.join(out, 'mech.json'), JSON.stringify(summary, null, 2));
let md = `# DevRadar mechanical eval\n\nBase: ${base}\nRun at (UTC): ${summary.at}\nOverall mechanical score (mean share of checks passing): ${overall}\n\nSite: ${Object.entries(site).map(([k, v]) => `${k} ${v}`).join(', ')}\n\n| Page | HTTP | Pass | Score | Failing checks |\n|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.id} | ${r.status} | ${r.pass}/${r.total} | ${r.score} | ${Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')} |\n`;
md += `\nTitles:\n${results.map(r => `- ${r.id}: "${r.title}" (${(r.title || '').length} chars); meta ${(r.meta || '').length} chars`).join('\n')}\n`;
fs.writeFileSync(path.join(out, 'mech.md'), md);
const hist = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../scores/mech-history.csv');
if (!fs.existsSync(hist)) fs.writeFileSync(hist, 'at_utc,base,page,pass,total,score\n');
fs.appendFileSync(hist, results.map(r => `${summary.at},${base},${r.id},${r.pass},${r.total},${r.score}`).join('\n') + '\n');
console.log(`overall ${overall}\nwrote ${out}`);
