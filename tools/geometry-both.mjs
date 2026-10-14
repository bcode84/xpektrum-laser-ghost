// Section geometry of live vs local at a given width (one page load each).
// Usage: node tools/geometry-both.mjs <liveUrl> <localUrl> <width>
import { chromium } from 'playwright';
const [liveUrl, localUrl, w] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (compatible; XpektrumMigrationAudit/1.0; site-owner migration) Chrome/140 Safari/537.36';
const b = await chromium.launch();
const measure = async (url, ua) => {
  const ctx = await b.newContext({ viewport: { width: +w, height: 900 }, isMobile: +w < 500, hasTouch: +w < 500, deviceScaleFactor: +w < 500 ? 2 : 1, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
  await p.waitForTimeout(1000);
  const r = await p.$$eval('#header, section[id], footer#footer', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, top: Math.round(r.top + scrollY), h: Math.round(r.height) }; }));
  await ctx.close(); return r;
};
const live = await measure(liveUrl, UA);
const mine = await measure(localUrl);
for (const m of mine) {
  const l = live.find((x) => x.id === m.id) || {};
  console.log(`${m.id.padEnd(38)} live h ${String(l.h ?? '-').padStart(5)} | new h ${String(m.h).padStart(5)} | Δh ${l.h != null ? m.h - l.h : '-'}`);
}
await b.close();
