// Crop the same vertical region from two full-page PNGs into one side-by-side JPEG.
// Usage: node tools/crop-region.mjs <live.png> <new.png> <y> <h> <out.jpg> [displayWidth=700]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [a, b, y, h, out, dw = '700'] = process.argv.slice(2);
const src = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2 * +dw + 20, height: 400 } });
await page.setContent(`<body style="margin:0;background:#333;display:flex;gap:20px">${[a, b].map((f) => `<div style="width:${dw}px;height:${h * dw / 1440}px;overflow:hidden;position:relative"><img id="i" style="position:absolute;left:0;width:${dw}px;top:-${y * dw / 1440}px" src="${src(f)}"></div>`).join('')}</body>`);
await page.waitForTimeout(400);
await page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
await browser.close();
