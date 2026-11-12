import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("icons/apps");
await mkdir(dir, { recursive: true });

const icons = {
  "event-scanner": ["#5CD68C", `<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 9.5h16M8 3.5v3M16 3.5v3"/>`],
  "developer-profiler": ["#7FB2FF", `<circle cx="9" cy="8" r="2.4"/><path d="M4.8 16.5c.5-2.4 2.2-3.6 4.2-3.6s3.7 1.2 4.2 3.6"/><path d="M15 8.5l1.6 1.2L19 7M14.5 12.5h4.5M14.5 15h3"/>`],
  "social-trends": ["#F2B45C", `<path d="M4 16.5l5-5 3 3 7-7"/><path d="M14 7.5h5V12"/>`],
  influencers: ["#F28FB0", `<path d="M12 3.8l1.9 3.9 4.3.6-3.1 3 0.7 4.3L12 13.6 8.2 15.6l.7-4.3-3.1-3 4.3-.6z"/>`],
  "docs-scanner": ["#9C8CFF", `<path d="M7 4.5h7.2L18 8.2V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z"/><path d="M14 4.6V8.4H18M8.5 12h4"/><circle cx="15.2" cy="15.2" r="2.3"/><path d="M16.8 16.8L18.6 18.6"/>`],
  looper: ["#4FD1D9", `<path d="M7 8.5A4.2 4.2 0 0 1 15.5 8"/><path d="M14.2 5.2L15.8 8.2 12.8 9"/><path d="M17 15.5A4.2 4.2 0 0 1 8.5 16"/><path d="M9.8 18.8L8.2 15.8 11.2 15"/>`],
  competition: ["#FF8A6B", `<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>`],
  "deep-scan": ["#5CD68C", `<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 12l5.2-3.2"/><path d="M12 4.8V7M12 17v2.2M4.8 12H7M17 12h2.2"/>`],
  ideas: ["#F5D76E", `<path d="M9 16.5h6M9.8 18.5h4.4"/><path d="M12 4.2a5 5 0 0 0-2.6 9.3c.4.3.6.8.6 1.3h4c0-.5.2-1 .6-1.3A5 5 0 0 0 12 4.2z"/>`],
};

for (const [name, [color, body]] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
  await writeFile(path.join(dir, `${name}.svg`), svg);
}
console.log("icons", Object.keys(icons).length);
