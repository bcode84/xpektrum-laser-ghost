// Extract computed design tokens, animations, chart data and component styles from the live home page.
// Usage: node tools/extract-tokens.mjs <outFile.json> [url]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const [outFile, url = 'https://laser.xpektrum.com/'] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (compatible; XpektrumMigrationAudit/1.0; site-owner migration) Chrome/140 Safari/537.36';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: UA });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

const data = await page.evaluate(() => {
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textTransform', 'padding', 'margin', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius', 'boxShadow', 'textShadow',
    'transition', 'animation', 'transform', 'opacity', 'width', 'height', 'maxWidth', 'gap', 'display', 'gridTemplateColumns', 'backdropFilter', 'filter', 'mixBlendMode'];
  const pick = (el) => { const cs = getComputedStyle(el); const o = {}; for (const p of PROPS) o[p] = cs[p]; const r = el.getBoundingClientRect(); o.rect = [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]; return o; };

  // 1. All custom properties declared on :root/html/body (resolved).
  const vars = {};
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = (rs) => { for (const r of rs) { if (r.cssRules) walk(r.cssRules); if (r.style) for (const n of r.style) if (n.startsWith('--')) vars[n] = null; } };
    walk(rules);
  }
  const rootCS = getComputedStyle(document.documentElement);
  for (const n of Object.keys(vars)) vars[n] = rootCS.getPropertyValue(n).trim();
  for (const n of document.documentElement.style) if (n.startsWith('--')) vars[n] = rootCS.getPropertyValue(n).trim();

  // 2. Keyframes and running animations.
  const keyframes = {};
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = (rs) => { for (const r of rs) { if (r.cssRules && r.type !== CSSRule.KEYFRAMES_RULE) walk(r.cssRules); if (r.type === CSSRule.KEYFRAMES_RULE) keyframes[r.name] = r.cssText; } };
    walk(rules);
  }
  const animations = document.getAnimations().map((a) => {
    const t = a.effect?.target; const timing = a.effect?.getTiming?.();
    return { name: a.animationName || a.transitionProperty || a.constructor.name, target: t ? (t.tagName + '.' + String(t.className?.baseVal ?? t.className).slice(0, 160)) : null,
      text: t?.textContent?.trim().slice(0, 60), duration: timing?.duration, iterations: timing?.iterations, easing: timing?.easing, direction: timing?.direction };
  });

  // 3. Fonts actually loaded.
  const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`);

  // 4. Sections with key component styles.
  const sections = [...document.querySelectorAll('section')].map((s) => ({
    id: s.id, cls: s.className, style: pick(s), headings: [...s.querySelectorAll('h1,h2,h3')].slice(0, 3).map((h) => ({ tag: h.tagName, text: h.textContent.trim().slice(0, 80), style: pick(h) })),
  }));
  const sample = (sel, n = 3) => [...document.querySelectorAll(sel)].slice(0, n).map((e) => ({ sel, text: e.textContent.trim().slice(0, 60), cls: String(e.className?.baseVal ?? e.className).slice(0, 300), style: pick(e) }));
  const components = {
    body: pick(document.body),
    links: sample('a', 12), buttons: sample('button', 8), paragraphs: sample('p', 8), header: sample('header, nav', 2), footer: sample('footer', 1),
    images: [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight, loading: i.loading, rect: pick(i).rect })),
  };

  // 5. Chart (Recharts) – raw SVG and data-ish attributes.
  const chart = [...document.querySelectorAll('.recharts-wrapper')].map((w) => ({
    html: w.outerHTML.slice(0, 20000),
    ticks: [...w.querySelectorAll('.recharts-cartesian-axis-tick-value, .recharts-text')].map((t) => t.textContent),
    paths: [...w.querySelectorAll('path')].map((p) => ({ d: p.getAttribute('d'), cls: p.getAttribute('class'), stroke: p.getAttribute('stroke'), fill: p.getAttribute('fill') })),
    legend: [...w.querySelectorAll('.recharts-legend-item')].map((t) => t.textContent),
  }));

  // 6. Marquee / carousel elements.
  const marquee = sample('[class*="marquee"], [class*="animate-"]', 10);
  const htmlClass = document.documentElement.className;
  const meta = [...document.querySelectorAll('meta, link[rel="canonical"], link[rel="icon"], link[rel="apple-touch-icon"], script[type="application/ld+json"]')].map((m) => m.outerHTML.slice(0, 800));
  return { htmlClass, title: document.title, vars, keyframes, animations, fonts, sections, components, chart, marquee, meta };
});

// Hover states for first few links/buttons in key sections.
const hovers = [];
for (const sel of ['header a', 'section a', 'section button', '[class*="group"]']) {
  const els = await page.$$(sel);
  for (const el of els.slice(0, 4)) {
    try {
      const before = await el.evaluate((e) => { const c = getComputedStyle(e); return { color: c.color, bg: c.backgroundColor, shadow: c.boxShadow, transform: c.transform, border: c.borderColor, text: e.textContent.trim().slice(0, 40) }; });
      await el.hover({ timeout: 2000 }); await page.waitForTimeout(600);
      const after = await el.evaluate((e) => { const c = getComputedStyle(e); return { color: c.color, bg: c.backgroundColor, shadow: c.boxShadow, transform: c.transform, border: c.borderColor }; });
      hovers.push({ sel, before, after });
    } catch {}
  }
}
data.hovers = hovers;

// Header dropdowns: open every aria-expanded control in the header and record revealed links.
const linksIn = (sel) => page.$$eval(sel, (as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().replace(/\s+/g, ' '), visible: !!a.offsetParent })));
data.navDesktop = { before: await linksIn('#header a') };
for (const btn of await page.$$('#header [aria-expanded]')) {
  try { await btn.hover(); await btn.click({ timeout: 2000 }); await page.waitForTimeout(500); } catch {}
}
data.navDesktop.after = await linksIn('#header a, [role="menu"] a, [data-radix-popper-content-wrapper] a');

// Mobile menu at 390px.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
for (const btn of await page.$$('#header button')) { try { if (await btn.isVisible()) { await btn.click({ timeout: 2000 }); await page.waitForTimeout(700); } } catch {} }
data.navMobile = await linksIn('#header a');
await page.screenshot({ path: outFile.replace(/\.json$/, '-mobile-menu.png') });
await fs.writeFile(outFile, JSON.stringify(data, null, 2));
await browser.close();
console.log('ok', Object.keys(data.vars).length, 'vars', data.animations.length, 'animations', data.chart.length, 'charts');
