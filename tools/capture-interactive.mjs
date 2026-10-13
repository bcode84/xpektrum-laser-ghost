// Recover content that React only mounts on interaction (Radix tabs, accordions, dialogs).
// Usage: node tools/capture-interactive.mjs <outFile.json> <slug> [<slug>...]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const [outFile, ...slugs] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (compatible; XpektrumMigrationAudit/1.0; site-owner migration) Chrome/140 Safari/537.36';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: UA });
const result = {};
const text = (el) => el.evaluate((e) => e.textContent.trim().replace(/\s+/g, ' '));

for (const slug of slugs) {
  await page.goto(`https://laser.xpektrum.com/${slug}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  const r = { tabs: {}, accordions: {}, dialogs: [] };

  for (const t of await page.$$('[role="tab"]')) {
    const key = await text(t);
    await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(400);
    const id = await t.getAttribute('aria-controls');
    r.tabs[key] = await page.$eval(`[id="${id}"]`, (e) => e.innerHTML).catch(() => null);
  }
  for (const a of await page.$$('[data-slot="accordion-trigger"]')) {
    const key = await text(a);
    await a.scrollIntoViewIfNeeded(); await a.click(); await page.waitForTimeout(400);
    const id = await a.getAttribute('aria-controls');
    r.accordions[key] = await page.$eval(`[id="${id}"]`, (e) => e.innerHTML).catch(() => null);
    await a.click(); await page.waitForTimeout(200);
  }
  const triggers = await page.$$('[data-slot="dialog-trigger"]');
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(600);
    const html = await page.$eval('[role="dialog"]', (e) => e.innerHTML).catch(() => null);
    r.dialogs.push({ index: i, trigger: (await text(t)).slice(0, 80), html });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  result[slug] = r;
  console.log(slug, Object.keys(r.tabs).length, 'tabs', Object.keys(r.accordions).length, 'accordions', r.dialogs.length, 'dialogs');
  await page.waitForTimeout(1500);
}
await fs.writeFile(outFile, JSON.stringify(result, null, 2));
await browser.close();
