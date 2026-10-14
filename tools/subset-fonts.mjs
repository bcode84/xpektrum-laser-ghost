// Subset captured JetBrains Mono TTFs to Latin WOFF2 for self-hosting.
// Usage: node tools/subset-fonts.mjs <ttfDir> <outDir>
import subsetFont from 'subset-font';
import * as fontkit from 'fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';
const [dir, outDir] = process.argv.slice(2);
// Basic Latin + Latin-1 + general punctuation, arrows used by the design (→ ↗), ₂ for CO₂.
let chars = '';
for (let c = 0x20; c <= 0x7e; c++) chars += String.fromCodePoint(c);
for (let c = 0xa0; c <= 0xff; c++) chars += String.fromCodePoint(c);
chars += '–—‘’“”•…€™←↑→↓↗×₂';
for (const f of await fs.readdir(dir)) {
  const buf = await fs.readFile(path.join(dir, f));
  const font = fontkit.create(buf);
  const weight = font['OS/2'].usWeightClass;
  const out = await subsetFont(buf, chars, { targetFormat: 'woff2' });
  const name = `jetbrains-mono-${weight}.woff2`;
  await fs.writeFile(path.join(outDir, name), out);
  console.log(name, buf.length, '->', out.length, font.familyName, font.subfamilyName);
}
