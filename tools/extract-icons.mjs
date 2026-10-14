// Extract Lucide icons used on the live site into Handlebars partials (partials/icons/<name>.hbs).
// Usage: node tools/extract-icons.mjs <capturePagesDir> <themeDir>
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
const [pagesDir, themeDir] = process.argv.slice(2);
const icons = {};
for (const d of await fs.readdir(pagesDir)) {
  const f = path.join(pagesDir, d, 'rendered.html');
  const html = await fs.readFile(f, 'utf8').catch(() => null);
  if (!html) continue;
  const $ = cheerio.load(html);
  $('svg.lucide').each((_, el) => {
    const name = ($(el).attr('class').match(/lucide-([a-z0-9-]+)/) || [])[1];
    if (name && !icons[name]) icons[name] = $(el).html();
  });
}
// Not on the live site but needed by the theme.
icons.x ??= '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>';
for (const [name, inner] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}{{#if class}} {{class}}{{/if}}" aria-hidden="true" focusable="false">${inner}</svg>\n`;
  await fs.writeFile(path.join(themeDir, 'partials', 'icons', `${name}.hbs`), svg);
}
console.log(Object.keys(icons).sort().join(' '));
