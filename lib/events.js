import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTHS_TITLE = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STOP = new Set("developers developer application applications engineers engineer users user teams team software the and for with who your of in a to on people builders target apps app use using used via from like into over across around our their this that are is be".split(" "));

const ALIASES = {
  ai: ["data", "python"],
  ml: ["data", "python"],
  llm: ["data", "python"],
  data: ["data", "python"],
  frontend: ["javascript", "typescript", "css", "ux"],
  web: ["javascript", "typescript", "css"],
  react: ["javascript"],
  vue: ["javascript"],
  node: ["javascript"],
  backend: ["java", "golang", "python", "rust", "php", "api"],
  mobile: ["ios", "android", "kotlin"],
  cloud: ["devops", "sre"],
  kubernetes: ["devops", "sre"],
  k8s: ["devops", "sre"],
  devops: ["devops", "sre"],
  security: ["security"],
  api: ["api"],
  devrel: ["leadership", "general"],
  community: ["leadership", "general"],
  design: ["ux", "css"],
  product: ["product", "ux"],
};

const CITIES = {
  "new york": [40.7128, -74.006],
  brooklyn: [40.6782, -73.9442],
  queens: [40.7282, -73.7949],
  "jersey city": [40.7178, -74.0431],
  newark: [40.7357, -74.1724],
  "san francisco": [37.7749, -122.4194],
  oakland: [37.8044, -122.2712],
  "san jose": [37.3382, -121.8863],
  sunnyvale: [37.3688, -122.0363],
  "mountain view": [37.3861, -122.0839],
  "los angeles": [34.0522, -118.2437],
  seattle: [47.6062, -122.3321],
  austin: [30.2672, -97.7431],
  boston: [42.3601, -71.0589],
  cambridge: [42.3736, -71.1097],
  chicago: [41.8781, -87.6298],
  denver: [39.7392, -104.9903],
  atlanta: [33.749, -84.388],
  miami: [25.7617, -80.1918],
  washington: [38.9072, -77.0369],
  london: [51.5074, -0.1278],
  paris: [48.8566, 2.3522],
  berlin: [52.52, 13.405],
  amsterdam: [52.3676, 4.9041],
  munich: [48.1351, 11.582],
  muenchen: [48.1351, 11.582],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  sydney: [-33.8688, 151.2093],
  toronto: [43.6532, -79.3832],
  vancouver: [49.2827, -123.1207],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  lisbon: [38.7223, -9.1393],
  dublin: [53.3498, -6.2603],
  barcelona: [41.3874, 2.1686],
  madrid: [40.4168, -3.7038],
  zurich: [47.3769, 8.5417],
  vienna: [48.2082, 16.3738],
  warsaw: [52.2297, 21.0122],
  "tel aviv": [32.0853, 34.7818],
  "hong kong": [22.3193, 114.1694],
  seoul: [37.5665, 126.978],
  portland: [45.5152, -122.6784],
  "las vegas": [36.1699, -115.1398],
  "salt lake city": [40.7608, -111.891],
  dallas: [32.7767, -96.797],
  houston: [29.7604, -95.3698],
  philadelphia: [39.9526, -75.1652],
  "san diego": [32.7157, -117.1611],
  montreal: [45.5017, -73.5673],
  delhi: [28.7041, 77.1025],
  "new delhi": [28.6139, 77.209],
  goa: [15.2993, 74.124],
  stockholm: [59.3293, 18.0686],
  copenhagen: [55.6761, 12.5683],
  helsinki: [60.1699, 24.9384],
  oslo: [59.9139, 10.7522],
  brussels: [50.8503, 4.3517],
  krakow: [50.0647, 19.945],
  kraków: [50.0647, 19.945],
  athens: [37.9838, 23.7275],
  prague: [50.0755, 14.4378],
  budapest: [47.4979, 19.0402],
  rome: [41.9028, 12.4964],
  milan: [45.4642, 9.19],
  melbourne: [-37.8136, 144.9631],
  auckland: [-36.8509, 174.7645],
  "cape town": [-33.9249, 18.4241],
  nairobi: [-1.2921, 36.8219],
  "sao paulo": [-23.5558, -46.6396],
  "mexico city": [19.4326, -99.1332],
  dubai: [25.2048, 55.2708],
  taipei: [25.033, 121.5654],
  shanghai: [31.2304, 121.4737],
  beijing: [39.9042, 116.4074],
  jakarta: [-6.2088, 106.8456],
  bangkok: [13.7563, 100.5018],
  "kuala lumpur": [3.139, 101.6869],
  mumbai: [19.076, 72.8777],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  waterloo: [43.4643, -80.5204],
  ottawa: [45.4215, -75.6972],
  minneapolis: [44.9778, -93.265],
  phoenix: [33.4484, -112.074],
  detroit: [42.3314, -83.0458],
  cologne: [50.9375, 6.9603],
  hamburg: [53.5511, 9.9937],
  frankfurt: [50.1109, 8.6821],
  antwerp: [51.2194, 4.4025],
  vilnius: [54.6872, 25.2797],
  riga: [56.9496, 24.1052],
  tallinn: [59.437, 24.7536],
  bucharest: [44.4268, 26.1025],
  sofia: [42.6977, 23.3219],
  belgrade: [44.7866, 20.4489],
  istanbul: [41.0082, 28.9784],
  "clearwater": [27.9659, -82.8001],
  orlando: [28.5383, -81.3792],
  "salt lake": [40.7608, -111.891],
};

let cache = null;

function miles(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cityKey(value) {
  return String(value || "").split(",")[0].trim().toLowerCase();
}

export function parsePlace(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^(online|remote|virtual)$/i.test(raw)) return { online: true, label: "Online", radius: 0, key: "", coords: null };
  const radiusMatch = /(\d+(?:\.\d+)?)\s*(mi|km|miles|kilometers)\b/i.exec(raw);
  let radius = 50;
  if (radiusMatch) {
    radius = Number(radiusMatch[1]);
    if (/km|kilometer/i.test(radiusMatch[2])) radius *= 0.621371;
  }
  const place = raw
    .replace(radiusMatch?.[0] || "", "")
    .replace(/[·•|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,\s-]+|[,\s-]+$/g, "");
  const key = cityKey(place);
  return { online: false, label: place || raw, key, radius, coords: CITIES[key] || null };
}

function keywords(market) {
  return String(market || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

function topicTargets(words) {
  const topics = new Set(words);
  for (const word of words) for (const topic of ALIASES[word] || []) topics.add(topic);
  return topics;
}

function nameHas(name, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(name);
}

function topicScore(event, words, targets) {
  const name = `${event.name || ""}`;
  const topics = event.topics || [];
  if (!words.length) {
    return topics.some((topic) => ["javascript", "general", "data", "devops", "python", "security", "api", "opensource"].includes(topic)) ? 0.5 : 0.28;
  }
  let score = 0;
  for (const word of words) if (word.length > 1 && nameHas(name, word)) score += 0.8;
  if (topics.some((topic) => targets.has(topic))) score += 0.45;
  return Math.min(1, score);
}

function locationScore(event, place) {
  const eventOnline = Boolean(event.online);
  const eventKey = cityKey(event.city);
  const eventCoords = CITIES[eventKey] || null;
  if (!place || place.online) return eventOnline ? 1 : 0.22;
  if (eventKey && place.key && eventKey === place.key) return 1;
  if (place.coords && eventCoords) {
    const distance = miles(place.coords, eventCoords);
    if (distance <= place.radius) return 1;
    if (distance <= place.radius * 4) return 0.62;
    return eventOnline ? 0.4 : 0.12;
  }
  if (eventOnline) return 0.4;
  return 0.16;
}

function inWindow(event, now, months) {
  const start = new Date(`${event.startDate}T00:00:00Z`);
  const end = new Date(`${(event.endDate || event.startDate)}T23:59:59Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const horizon = new Date(now.getTime());
  horizon.setUTCMonth(horizon.getUTCMonth() + months);
  return end >= now && start <= horizon;
}

function eventId(event) {
  return createHash("sha1").update(`${event.name}|${event.startDate}|${event.url || ""}`).digest("hex").slice(0, 16);
}

function formatShort(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS_TITLE[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function describe(event, now) {
  const kind = /hackathon/i.test(event.name) ? "Hackathon" : /meetup/i.test(event.name) ? "Meetup" : "Conference";
  if (event.cfpEndDate) {
    const end = new Date(`${event.cfpEndDate}T23:59:59Z`);
    if (!Number.isNaN(end.getTime())) {
      return end >= now ? `${kind} · CFP open to ${formatShort(event.cfpEndDate)}` : `${kind} · CFP closed`;
    }
  }
  return kind;
}

function actionFor(event, fit, now) {
  if (/hackathon/i.test(event.name)) return "Sponsor a prize";
  if (/meetup/i.test(event.name)) return "Lightning talk";
  if (event.cfpEndDate) {
    const end = new Date(`${event.cfpEndDate}T23:59:59Z`);
    if (!Number.isNaN(end.getTime()) && end >= now) return "Submit a talk";
  }
  if (fit >= 82) return "Talk + booth";
  if (fit >= 68) return "Lightning talk";
  return "Attend";
}

function placeLabel(event) {
  if (event.city && event.country) return event.online ? `${event.city}, ${event.country}` : `${event.city}, ${event.country}`;
  if (event.city) return event.city;
  if (event.online) return "Online";
  return event.country || "Online";
}

export async function loadConferences() {
  if (cache) return cache;
  const root = path.join(process.cwd(), "data", "conferences");
  const merged = new Map();
  let years = [];
  try {
    years = await readdir(root);
  } catch {
    years = [];
  }
  for (const year of years) {
    let files = [];
    try {
      files = await readdir(path.join(root, year));
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const topic = file.slice(0, -5);
      let rows = [];
      try {
        rows = JSON.parse(await readFile(path.join(root, year, file), "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row?.name || !row?.startDate) continue;
        const key = `${row.name}|${row.startDate}|${row.url || ""}`;
        const existing = merged.get(key);
        if (existing) {
          if (!existing.topics.includes(topic)) existing.topics.push(topic);
          continue;
        }
        merged.set(key, { ...row, topics: [topic] });
      }
    }
  }
  cache = [...merged.values()];
  return cache;
}

export function rankEvents(events, { market, location, months }, now = new Date()) {
  const place = parsePlace(location);
  const words = keywords(market);
  const targets = topicTargets(words);
  const ranked = [];
  for (const event of events) {
    if (!inWindow(event, now, months)) continue;
    const topic = topicScore(event, words, targets);
    const where = locationScore(event, place);
    if (topic < 0.28 && where < 0.95) continue;
    if (where < 0.2 && topic < 0.75) continue;
    const fit = Math.max(1, Math.min(99, Math.round((0.64 * topic + 0.36 * where) * 100)));
    const start = new Date(`${event.startDate}T12:00:00Z`);
    ranked.push({
      id: eventId(event),
      name: event.name,
      url: event.url || "",
      startDate: event.startDate,
      endDate: event.endDate || event.startDate,
      month: MONTHS[start.getUTCMonth()],
      day: String(start.getUTCDate()),
      location: placeLabel(event),
      online: Boolean(event.online) && !event.city,
      description: describe(event, now),
      fit,
      action: actionFor(event, fit, now),
      topics: event.topics,
    });
  }
  ranked.sort((a, b) => b.fit - a.fit || a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  return ranked.slice(0, 24);
}

export const WINDOWS = [1, 3, 6, 12];
