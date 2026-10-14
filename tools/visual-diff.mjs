// Visual diff: screenshot the local Ghost site like tools/capture.mjs did for the live site, then compare.
// Usage: node tools/visual-diff.mjs <baseUrl> <outDir> <slug>[,<slug>...] [widths=1440,768,390]
// Writes <outDir>/<slug>/{new-<w>.png, diff-<w>.png, side-<w>.jpg} and <outDir>/report.json
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs/promises';
import path from 'node:path';

const [base, outDir, slugsArg, widthsArg = '1440,768,390'] = process.argv.slice(2);
const slugs = slugsArg.split(',');
const VIEWPORTS = { 1440: { width: 1440, height: 900 }, 768: { width: 768, height: 1024 }, 390: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 } };
const widths = widthsArg.split(',');
const capDir = path.resolve('capture/pages');
const report = [];

const browser = await chromium.launch();
for (const w of widths) {
  const vp = VIEWPORTS[w];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor || 1, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile });
  for (const slug of slugs) {
    const page = await ctx.newPage();
    const url = base.replace(/\/$/, '') + (slug === 'home' ? '/' : `/${slug}/`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      // behavior 'instant': the theme sets scroll-behavior: smooth, which would leave the page mid-scroll.
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 150)); }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(1200);
    const dir = path.join(outDir, slug);
    await fs.mkdir(dir, { recursive: true });
    const newFile = path.join(dir, `new-${w}.png`);
    await page.screenshot({ path: newFile, fullPage: true });

    const oldFile = path.join(capDir, slug, `full-${w}.png`);
    const a = PNG.sync.read(await fs.readFile(oldFile));
    const b = PNG.sync.read(await fs.readFile(newFile));
    const width = Math.min(a.width, b.width);
    const height = Math.min(a.height, b.height);
    const crop = (img) => { const o = new PNG({ width, height }); PNG.bitblt(img, o, 0, 0, width, height, 0, 0); return o; };
    const diff = new PNG({ width, height });
    const mismatched = pixelmatch(crop(a).data, crop(b).data, diff.data, width, height, { threshold: 0.15 });
    await fs.writeFile(path.join(dir, `diff-${w}.png`), PNG.sync.write(diff));

    // Side-by-side (live | new), scaled for viewing.
    const side = await ctx.newPage();
    const scale = 360 / (a.width);
    await side.setViewportSize({ width: 740, height: 900 });
    await side.setContent(`<body style="margin:0;display:flex;gap:20px;background:#333">
      <img style="width:360px" src="data:image/png;base64,${(await fs.readFile(oldFile)).toString('base64')}">
      <img style="width:360px" src="data:image/png;base64,${(await fs.readFile(newFile)).toString('base64')}"></body>`);
    await side.waitForTimeout(300);
    await side.screenshot({ path: path.join(dir, `side-${w}.jpg`), type: 'jpeg', quality: 70, fullPage: true });
    await side.close();

    const entry = { slug, width: w, liveHeight: a.height, newHeight: b.height, heightDelta: b.height - a.height, mismatchPct: +(100 * mismatched / (width * height)).toFixed(2) };
    report.push(entry);
    console.log(JSON.stringify(entry));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
// Merge into an existing report so partial runs (one slug, one width) don't drop earlier results.
const reportFile = path.join(outDir, 'report.json');
const previous = JSON.parse(await fs.readFile(reportFile, 'utf8').catch(() => '[]'));
const key = (e) => `${e.slug}@${e.width}`;
const merged = new Map(previous.map((e) => [key(e), e]));
for (const e of report) merged.set(key(e), e);
await fs.writeFile(reportFile, JSON.stringify([...merged.values()].sort((a, b) => key(a).localeCompare(key(b))), null, 2));
