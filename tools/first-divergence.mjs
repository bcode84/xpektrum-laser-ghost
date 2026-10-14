// Find the first y where live and new full-page screenshots diverge (row-wise mismatch > 2%).
// Usage: node tools/first-divergence.mjs <live.png> <new.png>
import { PNG } from 'pngjs'; import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => PNG.sync.read(fs.readFileSync(f)));
const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
for (let y = 0; y < h; y++) {
  let bad = 0;
  for (let x = 0; x < w; x++) { const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4; if (Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]) > 60) bad++; }
  if (bad / w > 0.02) { console.log('first divergence at y =', y); process.exit(0); }
}
console.log('no divergence in overlap');
