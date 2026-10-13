// Download original images referenced by the live site.
// Usage: node tools/download-images.mjs <captureDir> <outDir>
// Reads <captureDir>/image-inventory.json and <captureDir>/wp-json/media*.json.
// Writes <outDir>/original/<yyyy>/<mm>/<file> and <outDir>/manifest.json.
import fs from 'node:fs/promises';
import path from 'node:path';

const [captureDir, outDir] = process.argv.slice(2);
const HOST = 'https://laser.xpektrum.com';
const UA = 'XpektrumMigrationAudit/1.0 (site-owner migration)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const inventory = JSON.parse(await fs.readFile(path.join(captureDir, 'image-inventory.json'), 'utf8'));
const media = [];
for (const f of (await fs.readdir(path.join(captureDir, 'wp-json'))).filter((f) => /^media(-\d+)?\.json$/.test(f))) {
  media.push(...JSON.parse(await fs.readFile(path.join(captureDir, 'wp-json', f), 'utf8')));
}
const byPath = new Map(media.map((m) => [new URL(m.source_url).pathname, m]));

// Map a referenced URL to candidate original URLs (best first).
function candidates(ref) {
  const u = new URL(ref, HOST);
  const p = decodeURI(u.pathname);
  const out = [];
  const m = byPath.get(u.pathname) || byPath.get(p);
  if (m?.media_details?.original_image) out.push(path.posix.join(path.posix.dirname(p), m.media_details.original_image));
  const stripped = p.replace(/-\d+x\d+(?=\.[a-z]+$)/i, '').replace(/-scaled(?=(-\d+)?\.[a-z]+$)/i, '');
  if (stripped !== p) out.push(stripped);
  out.push(p);
  return [...new Set(out)].map((x) => HOST + encodeURI(x));
}

// Incremental: keep previous results and only fetch refs not downloaded yet.
const manifest = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8').catch(() => '[]')).filter((m) => !m.error);
const done = new Set(manifest.map((m) => m.ref));
for (const [ref, alts] of Object.entries(inventory)) {
  if (done.has(ref)) continue;
  const u = new URL(ref, HOST);
  if (!u.pathname.startsWith('/wp-content/uploads/')) continue;
  const m = byPath.get(u.pathname);
  const alt = alts.find((a) => a && a.trim()) || m?.alt_text || '';
  let saved = null;
  for (const c of candidates(ref)) {
    await sleep(700);
    const res = await fetch(c, { headers: { 'User-Agent': UA } });
    if (!res.ok) { console.log(res.status, c); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const rel = decodeURIComponent(new URL(c).pathname).replace('/wp-content/uploads/', '');
    const file = path.join(outDir, 'original', rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
    saved = { ref, from: c, file: path.relative(outDir, file), bytes: buf.length, contentType: res.headers.get('content-type'), alt, mediaId: m?.id ?? null };
    console.log('ok', buf.length, rel);
    break;
  }
  manifest.push(saved || { ref, error: 'not found', alt });
}
// Favicon / site icon.
for (const p of ['/wp-content/uploads/2026/04/cropped-logo.png', '/wp-content/uploads/2026/04/logo.png']) {
  if (done.has(HOST + p)) continue;
  await sleep(700);
  const res = await fetch(HOST + p, { headers: { 'User-Agent': UA } });
  if (!res.ok) { console.log(res.status, p); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(outDir, 'original', p.replace('/wp-content/uploads/', ''));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  manifest.push({ ref: HOST + p, from: HOST + p, file: path.relative(outDir, file), bytes: buf.length, alt: 'Xpektrum Agency', mediaId: null });
}
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('done', manifest.filter((m) => !m.error).length, 'ok,', manifest.filter((m) => m.error).length, 'missing');
