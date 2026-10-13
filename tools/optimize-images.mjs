// Optimise downloaded originals to WebP for the Ghost import.
// Usage: node tools/optimize-images.mjs <imagesDir>   (reads manifest.json, writes optimized/ and updates manifest)
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2];
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const MAX_W = 2400;
const slugify = (s) => s.toLowerCase().replace(/\.(jpe?g|png|webp|avif)(?=[.-])/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
let before = 0, after = 0;
for (const m of manifest) {
  if (m.error) continue;
  const src = path.join(dir, m.file);
  const parsed = path.parse(m.file);
  const name = slugify(parsed.name.replace(/-scaled(-\d+)?$/, ''));
  const rel = path.join(path.dirname(m.file).replace(/^original\/?/, ''), name + '.webp');
  const out = path.join(dir, 'optimized', rel);
  await fs.mkdir(path.dirname(out), { recursive: true });
  const img = sharp(src, { animated: false }).rotate();
  const meta = await img.metadata();
  const pipeline = meta.width > MAX_W ? img.resize({ width: MAX_W, withoutEnlargement: true }) : img;
  const isLogo = /logo/.test(name);
  await pipeline.webp(isLogo ? { lossless: true } : { quality: 80, effort: 5, smartSubsample: true }).toFile(out);
  const o = await sharp(out).metadata();
  const st = await fs.stat(out);
  Object.assign(m, { optimized: rel, width: o.width, height: o.height, optimizedBytes: st.size });
  before += m.bytes; after += st.size;
}
await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`originals ${(before / 1e6).toFixed(1)} MB -> webp ${(after / 1e6).toFixed(1)} MB`);
