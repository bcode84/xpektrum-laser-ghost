// Usage: node crop.mjs <png> <outPrefix> <displayWidth> <chunkHeight>  -> vertical chunks as JPEG
import { chromium } from 'playwright';
import fs from 'node:fs';
const [png, out, dw = '720', ch = '1100'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +dw, height: +ch } });
await p.setContent(`<style>body{margin:0}img{width:${dw}px;display:block}</style><img src="data:image/png;base64,${fs.readFileSync(png).toString('base64')}">`);
await p.waitForSelector('img'); const h = await p.$eval('img', (i) => i.getBoundingClientRect().height);
for (let i = 0, y = 0; y < h; i++, y += +ch) await p.screenshot({ fullPage: true, path: `${out}${i}.jpg`, type: 'jpeg', quality: 70, clip: { x: 0, y, width: +dw, height: Math.min(+ch, h - y) } });
await b.close(); console.log(Math.ceil(h / ch), 'chunks');
