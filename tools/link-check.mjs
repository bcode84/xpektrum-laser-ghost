// Crawl a site from / and check every internal page, link, image (src, srcset, inline background-image),
// stylesheet and script. External URLs are listed, not fetched.
// Usage: node tools/link-check.mjs <baseUrl> [out.json]
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';

const base = new URL(process.argv[2] || 'http://localhost:2368/');
const outFile = process.argv[3] || 'docs/link-check.json';
const pages = new Map(); // url -> status
const assets = new Map(); // url -> { status, from:Set }
const external = new Map(); // url -> Set(from)
const queue = [base.href];

const norm = (u, from) => { try { const x = new URL(u, from); x.hash = ''; return x; } catch { return null; } };
const isInternal = (x) => x.origin === base.origin;
const note = (map, url, from) => { if (!map.has(url)) map.set(url, { status: null, from: new Set() }); map.get(url).from.add(from); };

while (queue.length) {
  const url = queue.shift();
  if (pages.has(url)) continue;
  const res = await fetch(url, { redirect: 'manual' });
  pages.set(url, res.status);
  if (res.status >= 300 && res.status < 400) {
    const loc = norm(res.headers.get('location'), url);
    if (loc && isInternal(loc)) queue.push(loc.href);
    continue;
  }
  if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
  const $ = cheerio.load(await res.text());
  $('a[href]').each((_, el) => {
    const h = $(el).attr('href');
    if (/^(mailto:|tel:|javascript:|#)/.test(h)) return;
    const x = norm(h, url);
    if (!x) return;
    if (!isInternal(x)) { if (!external.has(x.href)) external.set(x.href, new Set()); external.get(x.href).add(url); return; }
    if (/\/(ghost|content|assets)\//.test(x.pathname) || /\.(xml|txt|png|jpe?g|webp|avif|svg|pdf)$/.test(x.pathname)) note(assets, x.href, url);
    else if (!pages.has(x.href)) queue.push(x.href);
  });
  const srcs = [];
  $('img[src], source[src], script[src]').each((_, el) => srcs.push($(el).attr('src')));
  $('link[rel~="stylesheet"][href], link[rel~="icon"][href], link[rel="preload"][href]').each((_, el) => srcs.push($(el).attr('href')));
  $('img[srcset], source[srcset]').each((_, el) => $(el).attr('srcset').split(',').forEach((c) => srcs.push(c.trim().split(/\s+/)[0])));
  $('[style*="url("]').each((_, el) => { for (const m of $(el).attr('style').matchAll(/url\((['"]?)(.*?)\1\)/g)) srcs.push(m[2].replace(/&quot;/g, '')); });
  for (const s of srcs) {
    const x = norm(s, url);
    if (!x) continue;
    if (isInternal(x)) note(assets, x.href, url);
    else { if (!external.has(x.href)) external.set(x.href, new Set()); external.get(x.href).add(url); }
  }
}

for (const [url, a] of assets) {
  const res = await fetch(url, { method: 'GET' });
  a.status = res.status;
  await res.arrayBuffer();
}

const brokenPages = [...pages].filter(([, s]) => s >= 400);
const brokenAssets = [...assets].filter(([, a]) => a.status >= 400).map(([u, a]) => ({ url: u, status: a.status, from: [...a.from] }));
const report = {
  base: base.href,
  pages: Object.fromEntries(pages),
  assetsChecked: assets.size,
  brokenPages, brokenAssets,
  external: Object.fromEntries([...external].map(([u, f]) => [u, [...f]])),
};
await fs.writeFile(outFile, JSON.stringify(report, null, 2));
console.log(`pages ${pages.size} (${[...pages.values()].filter((s) => s === 200).length} × 200, ${[...pages.values()].filter((s) => s >= 300 && s < 400).length} redirects) · assets ${assets.size} · broken pages ${brokenPages.length} · broken assets ${brokenAssets.length} · external ${external.size}`);
for (const [u, s] of brokenPages) console.log('  BROKEN PAGE', s, u);
for (const b of brokenAssets) console.log('  BROKEN ASSET', b.status, b.url, '←', b.from[0]);
process.exitCode = brokenPages.length || brokenAssets.length ? 1 : 0;
