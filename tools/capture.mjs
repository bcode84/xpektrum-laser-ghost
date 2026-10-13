// Phase 1 capture: screenshots, rendered HTML and assets of the live site.
// Usage: node tools/capture.mjs <outDir> <urlsFile>
// Read-only, sequential, ~1 page navigation per second-ish, identifiable UA.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const [outDir, urlsFile] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (compatible; XpektrumMigrationAudit/1.0; site-owner migration) Chrome/140 Safari/537.36';
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugOf = (u) => new URL(u).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'home';

const urls = (await fs.readFile(urlsFile, 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean);
const assetIndex = {}; // url -> { file, type, status, bytes }
const savedAssets = new Set();

async function saveAsset(res) {
  const url = res.url();
  if (savedAssets.has(url) || url.startsWith('data:')) return;
  const type = res.request().resourceType();
  if (!['stylesheet', 'script', 'font', 'image', 'media'].includes(type)) return;
  savedAssets.add(url);
  try {
    const body = await res.body();
    const u = new URL(url);
    const rel = path.join('assets', u.hostname, decodeURIComponent(u.pathname).replace(/\/$/, '/index') + (u.search ? '__' + Buffer.from(u.search).toString('base64url').slice(0, 40) : ''));
    const file = path.join(outDir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    assetIndex[url] = { file: rel, type, status: res.status(), bytes: body.length, contentType: res.headers()['content-type'] };
  } catch (e) {
    assetIndex[url] = { error: String(e), type };
  }
}

const browser = await chromium.launch();
const report = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor || 1,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.isMobile,
    userAgent: UA,
  });
  for (const url of urls) {
    const page = await ctx.newPage();
    const pending = [];
    page.on('response', (r) => pending.push(saveAsset(r)));
    const t0 = Date.now();
    let status = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      status = resp?.status();
      // Scroll through to trigger lazy loading and scroll-reveal animations.
      await page.evaluate(async () => {
        const step = window.innerHeight / 2;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(1200);
      const slug = slugOf(url);
      const dir = path.join(outDir, 'pages', slug);
      await fs.mkdir(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `full-${vp.name}.png`), fullPage: true });
      await page.screenshot({ path: path.join(dir, `fold-${vp.name}.png`) });
      if (vp.name === '1440') await fs.writeFile(path.join(dir, 'rendered.html'), await page.content());
      report.push({ url, viewport: vp.name, status, ms: Date.now() - t0 });
      console.log(vp.name, status, url);
    } catch (e) {
      report.push({ url, viewport: vp.name, error: String(e) });
      console.log(vp.name, 'ERR', url, String(e).slice(0, 120));
    }
    await Promise.allSettled(pending);
    await page.close();
    await sleep(1500); // polite delay between navigations
  }
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(outDir, 'asset-index.json'), JSON.stringify(assetIndex, null, 2));
await fs.writeFile(path.join(outDir, 'capture-report.json'), JSON.stringify(report, null, 2));
