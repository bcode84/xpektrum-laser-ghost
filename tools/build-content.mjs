// Build the Ghost import (JSON + images ZIP) and redirects from the Phase 1 capture.
// Usage: node tools/build-content.mjs <repoRoot>
// Inputs:  capture/wp-json/*.json, capture/pages/<slug>/rendered.html, content-export/images/manifest.json
// Outputs: content-export/ghost-import.json, content-export/pages-html/*.html, content-export/redirects.json,
//          content-export/routes.yaml, content-export/unused/*.json
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const cap = (...p) => path.join(root, 'capture', ...p);
const out = (...p) => path.join(root, 'content-export', ...p);
const readJSON = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const HOST_RE = /^https?:\/\/(laser\.xpektrum\.com|better-elf-dev\.10web\.cloud|xpektrum\.io)/;

const PHONE = '+1 (438) 898-7540';
const EMAIL = 'info@xpektrum.com';

// ---------------------------------------------------------------- images
const manifest = await readJSON(out('images', 'manifest.json'));
const imageMap = new Map(); // normalised upload path -> { url, alt, w, h }
const norm = (u) => {
  try { return decodeURIComponent(new URL(u, 'https://laser.xpektrum.com').pathname).replace(/^\/wp-content\/uploads\//, ''); } catch { return null; }
};
for (const m of manifest) {
  if (!m.optimized) continue;
  const entry = { url: `__GHOST_URL__/content/images/${m.optimized}`, alt: m.alt, w: m.width, h: m.height };
  imageMap.set(norm(m.ref), entry);
  imageMap.set(norm(m.from), entry);
}
const missingImages = new Set();
function mapImage(u) {
  if (!u || u.startsWith('data:')) return null;
  if (!HOST_RE.test(u) && !u.startsWith('/wp-content/')) return null;
  const hit = imageMap.get(norm(u));
  if (!hit) missingImages.add(u);
  return hit || null;
}

// ---------------------------------------------------------------- links
const PAGE_ROUTE_FIX = {
  '/CorporateBrandingPage': '/corporate-branding/',
  '/CorporateGiftsPage': '/corporate-gifts/',
  '/HospitalityEventsPage': '/private-events/',
  '/HospitalityPage': '/hospitality/',
  '/IndustrialLabelsPage': '/industrial-labels/',
  '/IndustrialSignagePage': '/industrial-signage/',
};
function mapHref(h) {
  if (!h) return h;
  if (PAGE_ROUTE_FIX[h.replace(/\/$/, '')]) return PAGE_ROUTE_FIX[h.replace(/\/$/, '')];
  if (HOST_RE.test(h)) {
    const u = new URL(h);
    const p = u.pathname === '' ? '/' : u.pathname;
    return (PAGE_ROUTE_FIX[p.replace(/\/$/, '')] || p) + u.hash;
  }
  return h;
}

// ---------------------------------------------------------------- HTML cleaning
const KEEP_DATA = new Set(['data-slot', 'data-state', 'data-orientation', 'data-visible', 'data-xp-dialog', 'data-xp-form']);

// Content that React mounts only on interaction, captured by tools/capture-interactive.mjs.
const interactive = await readJSON(cap('interactive.json')).catch(() => ({}));
function injectInteractive($, slug) {
  const data = interactive[slug];
  if (!data) return;
  const txt = (el) => $(el).text().trim().replace(/\s+/g, ' ');
  const fill = (triggerSel, map) => $(triggerSel).each((_, t) => {
    const html = map[txt(t)];
    const id = $(t).attr('aria-controls');
    if (html && id) $(`[id="${id}"]`).html(html);
  });
  fill('[role="tab"]', data.tabs || {});
  fill('[data-slot="accordion-trigger"]', data.accordions || {});
  $('[data-slot="dialog-trigger"]').each((i, t) => {
    const d = (data.dialogs || [])[i];
    if (!d?.html) return;
    const id = `xp-dialog-${i + 1}`;
    $(t).attr('data-xp-dialog', id).attr('aria-haspopup', 'dialog');
    $(t).after(`<dialog class="xp-dialog bg-card text-foreground border border-border" id="${id}">${d.html}</dialog>`);
  });
}

// The quote form: native validation + hook for the hosted form service (theme JS posts it).
function prepareQuoteForm($wrap, $) {
  const REQUIRED = new Set(['name', 'email', 'phone', 'project_details']);
  const AUTOCOMPLETE = { name: 'name', email: 'email', phone: 'tel', project_type: 'off', project_details: 'off' };
  $wrap.find('form').each((_, f) => {
    $(f).attr('data-xp-form', 'quote').attr('method', 'post').attr('action', '#');
    $(f).find('input, select, textarea').each((__, el) => {
      const n = $(el).attr('name');
      if (REQUIRED.has(n)) $(el).attr('required', '');
      if (AUTOCOMPLETE[n]) $(el).attr('autocomplete', AUTOCOMPLETE[n]);
      $(el).removeAttr('value').removeAttr('style');
    });
    $(f).find('button').attr('type', 'submit');
    $(f).append('<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="xp-hp">');
    $(f).after('<p class="xp-form-status" role="status" aria-live="polite" hidden></p>');
  });
}

function cleanSections($, sections, slug) {
  const $wrap = $('<div></div>');
  sections.forEach((s) => $wrap.append($(s).clone()));
  $wrap.find('script, style, noscript, link, meta').remove();
  $wrap.find('*').each((_, el) => {
    for (const a of Object.keys(el.attribs || {})) {
      if (a.startsWith('data-') && !KEEP_DATA.has(a)) $(el).removeAttr(a);
    }
    if (el.attribs?.['data-section-id']) $(el).removeAttr('data-section-id');
  });
  // Images: real source may be in src or lazy attributes.
  $wrap.find('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('data-src') || $el.attr('src');
    const img = mapImage(src);
    $el.removeAttr('srcset').removeAttr('sizes').removeAttr('data-src');
    if (img) {
      $el.attr('src', img.url);
      if (!$el.attr('alt')) $el.attr('alt', img.alt || '');
      $el.attr('width', img.w).attr('height', img.h);
    }
    $el.attr('loading', 'lazy').attr('decoding', 'async');
  });
  // CSS background images in inline styles.
  $wrap.find('[style*="url("]').each((_, el) => {
    const $el = $(el);
    $el.attr('style', $el.attr('style').replace(/url\((["']?|&quot;)([^)"']+)\1\)/g, (m, q, u) => {
      const img = mapImage(u);
      return img ? `url("${img.url}")` : m;
    }));
  });
  // Links.
  $wrap.find('a[href]').each((_, el) => $(el).attr('href', mapHref($(el).attr('href'))));
  if (slug === 'request-a-quote') prepareQuoteForm($wrap, $);
  // React useId values («r0») → plain ids, consistently in id/for/aria-* references.
  $wrap.find('[id], [for], [aria-controls], [aria-labelledby], [aria-describedby]').each((_, el) => {
    for (const a of ['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
      const v = $(el).attr(a);
      if (v && /[«»:]/.test(v)) $(el).attr(a, v.replace(/[«»:]/g, '').replace(/^radix-/, 'xp-'));
    }
  });
  $wrap.find('[style=""]').removeAttr('style');
  // Social placeholders inside content are dropped later by theme settings; phone/email become real links.
  let html = $wrap.html();
  html = html
    .replace(/\+1 \(514\) 555-0198/g, PHONE)
    .replace(/>CONTAT</g, '>CONTACT<')
    .replace(/\s+(?=<\/(h1|h2|h3|p|span)>)/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*\n/g, '\n');
  return html;
}

function mainSections($) {
  return $('section').toArray().filter((s) => {
    const id = $(s).attr('id');
    const text = $(s).text();
    return id !== 'header' && !/Status: Studio Online/.test(text);
  });
}

// ---------------------------------------------------------------- Lexical helpers
const lexicalHtml = (html) => JSON.stringify({ root: { children: [{ type: 'html', version: 1, html }], direction: null, format: '', indent: 0, type: 'root', version: 1 } });
const lexicalText = (paras) => JSON.stringify({
  root: {
    children: paras.map((t) => ({ children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: t, type: 'extended-text', version: 1 }], direction: 'ltr', format: '', indent: 0, type: 'paragraph', version: 1 })),
    direction: 'ltr', format: '', indent: 0, type: 'root', version: 1,
  },
});
const oid = (seed) => crypto.createHash('md5').update(seed).digest('hex').slice(0, 24);
const now = new Date().toISOString();

// ---------------------------------------------------------------- source data
const wpPages = await readJSON(cap('wp-json', 'pages.json'));
const decode = (s) => cheerio.load(`<p>${s}</p>`)('p').text().replace(/\s+/g, ' ').trim();

// Page metadata we add (the live site has none). Kept short and factual.
const META = {
  home: { title: 'Industrial Laser Engraving & Cutting in Montreal', description: 'B2B laser engraving and cutting studio in Montreal. xTool P3 80W CO2, 0.01 mm precision, 24 h prototype turnaround for agencies and industry.' },
  about: { description: 'Montreal-based B2B laser engraving studio built around the xTool P3 80W CO2 system. Precision, speed and commercial-grade reliability.' },
  'request-a-quote': { description: 'Request a laser engraving or cutting quote from Xpektrum Agency, Montreal. Send your specs and receive a precision-engineered quote within 24 hours.' },
  'co2-laser-specifications': { description: 'Technical specifications of our xTool P3 80W CO2 laser: power, speed, precision, working area and material compatibility.' },
  'industrial-signage': { description: 'Industrial identification: laser-engraved stainless steel, anodized aluminum and Rowmark tags and equipment plates for contractors and facilities.' },
  'industrial-labels': { description: 'Durable laser-engraved industrial labels, panel tags and safety markings built for compliance and harsh environments.' },
  'commercial-signage': { description: 'Laser-cut commercial signage: wayfinding, interior branding, plaques and display systems for Montreal businesses.' },
  'corporate-gifts': { description: 'Personalized laser-engraved corporate gifts and recognition awards, produced at volume with fast turnaround.' },
  'corporate-branding': { description: 'Precision laser branding for high-volume corporate orders: drinkware, tech merchandise, leather and more.' },
  hospitality: { description: 'Laser-engraved menus, room signage, coasters and branded accessories for hotels and restaurants.' },
  'private-events': { description: 'Precision-engraved décor and signage for private galas, corporate events and weddings in Montreal.' },
  'events-weddings': { description: 'Bespoke laser-cut wedding and event signage, favors, invitations and table décor.' },
  solutions: { description: 'Laser engraving solutions across industrial, corporate, hospitality and event sectors.' },
  services: { description: 'Our laser engraving services: corporate branding, hospitality items, industrial labels and more.' },
  portfolio: { description: 'Portfolio of Xpektrum laser engraving and cutting projects across industrial, corporate and event work.' },
};

// Templates per page (theme provides custom-*.hbs).
const TEMPLATE = { home: 'custom-home', 'request-a-quote': 'custom-quote' };
const SECTOR_SLUGS = ['industrial-labels', 'industrial-signage', 'commercial-signage', 'corporate-gifts', 'corporate-branding', 'hospitality', 'private-events', 'events-weddings'];

// Home sector cards (featured sectors, in order) – see audit §4.
const HOME_SECTORS = {
  'industrial-signage': { order: 1, card_title: 'Industrial & Technical', card_text: 'High-precision marking for industrial electricians and contractors. We produce durable panel tags, cable markers, and equipment plates with permanent CO2 laser accuracy.' },
  'private-events': { order: 2, card_title: 'Hospitality & Signage', card_text: 'Elevate your brand with custom menus, table numbers, and architectural wayfinding. We transform wood, acrylic, and leather into premium touchpoints for your venue.' },
  'corporate-branding': { order: 3, card_title: 'Corporate Branding', card_text: 'Scalable production for marketing agencies and corporate gifts. Fast-turnaround engraving on high-end merchandise that positions your brand as a market leader.' },
};

// ---------------------------------------------------------------- tags
const tags = [
  { id: oid('tag-project'), name: 'project', slug: 'project', description: 'Recent commercial projects shown on the home page.' },
  { id: oid('tag-sector'), name: '#sector', slug: 'hash-sector', visibility: 'internal', description: 'Sector pages listed in the Services menu.' },
  { id: oid('tag-sector-featured'), name: '#sector-featured', slug: 'hash-sector-featured', visibility: 'internal', description: 'Sector pages shown as cards on the home page (custom excerpt = card text, meta title = card title).' },
  { id: oid('tag-home'), name: '#home', slug: 'hash-home', visibility: 'internal' },
];
const tagId = Object.fromEntries(tags.map((t) => [t.name, t.id]));

const posts = [];
const postsTags = [];
const postsMeta = [];
const addTag = (postId, name, sort = 0) => postsTags.push({ id: oid(postId + name), post_id: postId, tag_id: tagId[name], sort_order: sort });

// ---------------------------------------------------------------- pages
await fs.mkdir(out('pages-html'), { recursive: true });
const report = [];
for (const wp of wpPages) {
  const slug = wp.slug;
  const dir = slug === 'home' ? 'home' : slug;
  const html = await fs.readFile(cap('pages', dir, 'rendered.html'), 'utf8');
  const $ = cheerio.load(html);
  const id = oid('page-' + slug);
  const title = decode(wp.title.rendered);
  const meta = META[slug] || {};
  let lexical = null;
  let body = '';
  if (slug !== 'home') {
    injectInteractive($, slug);
    body = cleanSections($, mainSections($), slug);
    body = `<div class="xp-legacy" data-page="${slug}">${body}</div>`;
    await fs.writeFile(out('pages-html', `${slug}.html`), body);
    lexical = lexicalHtml(body);
  } else {
    lexical = lexicalText([]);
  }
  const featured = HOME_SECTORS[slug];
  posts.push({
    id, uuid: crypto.randomUUID(), title, slug, type: 'page', status: 'published', visibility: 'public',
    lexical, mobiledoc: null, html: null,
    custom_excerpt: featured ? featured.card_text : null,
    custom_template: TEMPLATE[slug] || (SECTOR_SLUGS.includes(slug) ? 'custom-sector' : null),
    feature_image: null, featured: false,
    created_at: wp.date_gmt + '.000Z', updated_at: wp.modified_gmt + '.000Z', published_at: wp.date_gmt + '.000Z',
    author_id: '1',
  });
  postsMeta.push({
    id: oid('meta-' + slug), post_id: id,
    meta_title: featured ? null : (meta.title || null),
    meta_description: meta.description || null,
    og_title: featured ? featured.card_title : null,
  });
  if (SECTOR_SLUGS.includes(slug)) addTag(id, '#sector');
  if (featured) addTag(id, '#sector-featured', 1);
  if (slug === 'home') addTag(id, '#home');
  report.push({ slug, title, bytes: body.length, template: TEMPLATE[slug] || (SECTOR_SLUGS.includes(slug) ? 'custom-sector' : 'page') });
}

// Sector card order: Ghost sorts {{#get}} by published_at, so stagger the featured ones.
for (const [slug, s] of Object.entries(HOME_SECTORS)) {
  const p = posts.find((x) => x.slug === slug);
  p.published_at = new Date(Date.UTC(2026, 3, 1, 12, 0, 10 - s.order)).toISOString();
}

// ---------------------------------------------------------------- projects (from the Home bundle, audit §4)
const PROJECTS = [
  { title: 'Industrial Panel Tags', slug: 'industrial-panel-tags', excerpt: 'MATERIAL: ANODIZED ALUMINUM / CLIENT: HYDRO-QUEBEC', image: '2026/04/stainless_steel_tags.webp', layout: 'wide',
    body: 'High-precision laser engraving on anodized aluminum for industrial electrical panels. Engineered for durability in harsh environments with permanent, high-contrast marking.' },
  { title: 'Bespoke Menu Boards', slug: 'bespoke-menu-boards', excerpt: 'MATERIAL: RECLAIMED WALNUT / CLIENT: LE PETIT PLATEAU', image: '2026/05/coffee_shop_signage.webp', layout: 'tall',
    body: 'Custom laser-etched walnut menu boards for a high-end Montreal bistro. Features intricate logo detailing and a protective finish for heavy hospitality use.' },
  { title: 'Custom Branding for Corporate Gifting', slug: 'custom-branding-for-corporate-gifting', excerpt: 'MATERIAL: POWDER-COATED STEEL / CLIENT: NEXUS TECH', image: '2026/05/corporate_gifting_branding.webp', layout: 'tall',
    body: 'Branded executive gift sets featuring precision-etched logos on matte black steel. A perfect example of our high-volume, fast-turnaround commercial capabilities.' },
  { title: 'Architectural Signage', slug: 'architectural-signage', excerpt: 'MATERIAL: FROSTED ACRYLIC / CLIENT: VESTA OFFICES', image: '2026/04/xpektrum_office_signage.webp', layout: 'wide',
    body: 'Interior wayfinding and lobby branding using laser-cut frosted acrylic. Clean edges and precise typography reflect the modern aesthetic of professional office spaces.' },
];
PROJECTS.forEach((p, i) => {
  const id = oid('project-' + p.slug);
  const img = imageMap.get(p.image);
  if (!img) missingImages.add(p.image);
  // Newest first on the home page → publish in reverse order.
  const published = new Date(Date.UTC(2026, 4, 1, 12, 0, 10 - i)).toISOString();
  posts.push({
    id, uuid: crypto.randomUUID(), title: p.title, slug: p.slug, type: 'post', status: 'published', visibility: 'public',
    lexical: lexicalText([p.body]), mobiledoc: null, html: null,
    custom_excerpt: p.excerpt, custom_template: null,
    feature_image: img?.url || null, featured: p.layout === 'wide',
    created_at: published, updated_at: published, published_at: published, author_id: '1',
  });
  postsMeta.push({ id: oid('meta-' + p.slug), post_id: id, feature_image_alt: p.title, meta_description: `${p.body.slice(0, 150)}` });
  addTag(id, 'project');
});

// ---------------------------------------------------------------- settings & navigation
const settings = [
  { key: 'title', value: 'Xpektrum Agency' },
  { key: 'description', value: 'Montreal-based laser engraving and cutting studio specializing in high-precision industrial and commercial solutions.' },
  { key: 'logo', value: imageMap.get('2026/04/logo_gray.png')?.url },
  { key: 'icon', value: imageMap.get('2026/04/cropped-logo.png')?.url },
  { key: 'accent_color', value: '#ed7a1d' },
  { key: 'locale', value: 'en' },
  { key: 'timezone', value: 'America/Toronto' },
  { key: 'navigation', value: JSON.stringify([{ label: 'Home', url: '/' }, { label: 'Services', url: '/services/' }, { label: 'About', url: '/about/' }]) },
  { key: 'secondary_navigation', value: JSON.stringify([
    { label: 'Industrial Signage', url: '/industrial-signage/' }, { label: 'Hospitality Events', url: '/private-events/' },
    { label: 'Corporate Branding', url: '/corporate-branding/' }, { label: 'Request a Quote', url: '/request-a-quote/' },
  ]) },
  { key: 'meta_title', value: 'Xpektrum Agency – Industrial Laser Engraving & Cutting, Montreal' },
  { key: 'meta_description', value: META.home.description },
  { key: 'members_signup_access', value: 'none' },
  { key: 'comments_enabled', value: 'off' },
];

const ghostImport = {
  db: [{
    meta: { exported_on: Date.now(), version: '6.0.0' },
    data: { posts, posts_meta: postsMeta, tags, posts_tags: postsTags, settings, users: [], posts_authors: [] },
  }],
};
await fs.writeFile(out('ghost-import.json'), JSON.stringify(ghostImport, null, 2));

// ---------------------------------------------------------------- redirects & routes
const scenarios = await readJSON(cap('wp-json', 'scenario.json'));
const industrial = await readJSON(cap('wp-json', 'industrial_id.json'));
const redirects = [
  ...Object.entries(PAGE_ROUTE_FIX).map(([from, to]) => ({ from: `^${from}/?$`, to, permanent: true })),
  { from: '^/scenario/.*$', to: '/industrial-signage/', permanent: true },
  { from: '^/industrial_id/.*$', to: '/industrial-signage/', permanent: true },
  { from: '^/header_settings/.*$', to: '/', permanent: true },
  { from: '^/home/?$', to: '/', permanent: true },
  { from: '^/wp-sitemap(.*)\\.xml$', to: '/sitemap.xml', permanent: true },
  { from: '^/wp-content/uploads/(.*)$', to: '/', permanent: false },
  { from: '^/feed/?$', to: '/rss/', permanent: true },
];
await fs.writeFile(out('redirects.json'), JSON.stringify(redirects, null, 2));
await fs.writeFile(out('routes.yaml'), `# Ghost routes for the Xpektrum theme. Upload via Settings → Labs → Routes (bootstrap does this).
routes:
  /:
    data: page.home
    template: custom-home

collections:
  /projects/:
    permalink: /projects/{slug}/
    filter: tag:project
    template: index

taxonomies:
  tag: /tag/{slug}/
`);

// Keep CPT records that are not migrated as objects (data is in the industrial-signage page or unused variants).
await fs.mkdir(out('unused'), { recursive: true });
await fs.writeFile(out('unused', 'wp-cpt-records.json'), JSON.stringify({ scenario: scenarios.map((s) => ({ slug: s.slug, meta: s.meta })), industrial_id: industrial.map((s) => ({ slug: s.slug, meta: s.meta })) }, null, 2));

console.table(report);
console.log('posts', posts.filter((p) => p.type === 'post').length, 'pages', posts.filter((p) => p.type === 'page').length, 'redirects', redirects.length);
if (missingImages.size) console.log('UNMAPPED IMAGES:\n' + [...missingImages].join('\n'));
