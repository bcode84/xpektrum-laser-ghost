// side.mjs <live.png> <new.png> <top> <height> <out.jpg>  (device px; output scaled to 600px per side)
import sharp from 'sharp';
const [a, b, top, h, out] = process.argv.slice(2);
const crop = async (f) => { const m = await sharp(f).metadata(); return sharp(f).extract({ left: 0, top: +top, width: m.width, height: Math.min(+h, m.height - +top) }).resize({ width: 600 }).toBuffer(); };
const [ia, ib] = await Promise.all([crop(a), crop(b)]);
const [ma, mb] = await Promise.all([sharp(ia).metadata(), sharp(ib).metadata()]);
await sharp({ create: { width: 1220, height: Math.max(ma.height, mb.height), channels: 3, background: '#333' } })
  .composite([{ input: ia, left: 0, top: 0 }, { input: ib, left: 620, top: 0 }]).jpeg({ quality: 75 }).toFile(out);
