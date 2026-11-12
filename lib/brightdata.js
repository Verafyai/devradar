const REQUEST_URL = "https://api.brightdata.com/request";

function apiKey() {
  const key = process.env.BRIGHTDATA_API_KEY?.trim();
  return key || null;
}

export function brightDataConfigured() {
  return Boolean(apiKey());
}

export async function serpSearch(query) {
  const key = apiKey();
  if (!key) return { ok: false, hits: [], error: "Bright Data is not configured" };
  const zone = process.env.BRIGHTDATA_SERP_ZONE?.trim() || "serp_api1";
  const target = `https://www.google.com/search?${new URLSearchParams({
    q: query,
    hl: "en",
    gl: "us",
    num: "8",
    brd_json: "1",
  })}`;
  let response;
  try {
    response = await fetch(REQUEST_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify({ zone, url: target, format: "raw", country: "us" }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    return { ok: false, hits: [], error: err instanceof Error ? err.message : "Bright Data request failed" };
  }
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, hits: [], error: `Bright Data HTTP ${response.status}` };
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return { ok: true, hits: [] };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: true, hits: [] };
  }
  const hits = [];
  const walk = (value, depth) => {
    if (!value || typeof value !== "object" || depth > 6 || hits.length >= 8) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const url = typeof value.link === "string" ? value.link : typeof value.url === "string" ? value.url : "";
    const title = typeof value.title === "string" ? value.title : "";
    if (url.startsWith("http") && title) hits.push({ url, title });
    for (const child of Object.values(value)) walk(child, depth + 1);
  };
  walk(parsed, 0);
  const seen = new Set();
  return {
    ok: true,
    hits: hits.filter((hit) => (seen.has(hit.url) ? false : seen.add(hit.url))),
  };
}
