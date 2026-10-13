// Archive every media-library original (not imported into Ghost) for the owner's records.
// Usage: node tools/archive-media.mjs <captureDir> <outDir>
import fs from 'node:fs/promises';
import path from 'node:path';
const [captureDir, outDir] = process.argv.slice(2);
const UA = 'XpektrumMigrationAudit/1.0 (site-owner migration)';
const media = [];
for (const f of (await fs.readdir(path.join(captureDir, 'wp-json'))).filter((f) => /^media(-\d+)?\.json$/.test(f))) media.push(...JSON.parse(await fs.readFile(path.join(captureDir, 'wp-json', f), 'utf8')));
const index = [];
for (const m of media) {
  const src = new URL(m.source_url);
  const orig = m.media_details?.original_image ? path.posix.join(path.posix.dirname(src.pathname), m.media_details.original_image) : src.pathname;
  const rel = decodeURIComponent(orig).replace('/wp-content/uploads/', '');
  const file = path.join(outDir, rel);
  if (await fs.stat(file).catch(() => null)) { index.push({ id: m.id, file: rel, alt: m.alt_text }); continue; }
  await new Promise((r) => setTimeout(r, 700));
  const res = await fetch(src.origin + orig, { headers: { 'User-Agent': UA } });
  if (!res.ok) { index.push({ id: m.id, url: src.origin + orig, error: res.status }); continue; }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  index.push({ id: m.id, file: rel, alt: m.alt_text, title: m.title?.rendered });
}
await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));
console.log('archived', index.filter((i) => !i.error).length, 'errors', index.filter((i) => i.error).length);
