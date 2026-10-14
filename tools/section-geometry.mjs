// Compare section geometry (top/height) of the live capture vs the local site at a given width.
// Usage: node tools/section-geometry.mjs <localUrl> <width> [liveTokens.json]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, w = '1440', tokens = 'capture/tokens-home.json'] = process.argv.slice(2);
const live = JSON.parse(fs.readFileSync(tokens, 'utf8')).sections.map((s) => ({ id: s.id, top: s.style.rect[1], h: s.style.rect[3] }));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: 900 } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
await p.waitForTimeout(800);
const mine = await p.$$eval('#header, main > section, #footer', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, top: Math.round(r.top + scrollY), h: Math.round(r.height) }; }));
for (const m of mine) {
  const l = live.find((x) => x.id === m.id) || {};
  console.log(`${m.id.padEnd(38)} live top ${String(l.top ?? '-').padStart(5)} h ${String(l.h ?? '-').padStart(5)} | new top ${String(m.top).padStart(5)} h ${String(m.h).padStart(5)} | Δh ${l.h != null ? m.h - l.h : '-'}`);
}
await b.close();
