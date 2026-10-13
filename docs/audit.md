# Phase 1 – Audit of laser.xpektrum.com

Captured 2026-10-13 (read-only; sequential crawl, ≥1.5 s between navigations, UA `XpektrumMigrationAudit/1.0`).

## 1. What was captured

| Artifact | Location (local, not committed – large binaries) |
|---|---|
| Full-page + above-the-fold screenshots, 23 URLs × 1440 / 768 / 390 px (69 captures, all HTTP 200) | `capture/pages/<slug>/full-<w>.png`, `fold-<w>.png` |
| Rendered DOM (post-hydration) per URL | `capture/pages/<slug>/rendered.html` |
| All CSS (62), JS (90), fonts (4), images (97) actually requested by the browser | `capture/assets/<host>/…`, index in `capture/asset-index.json` |
| WP REST dumps (pages, media ×265, types, CPTs, users) + sitemaps | `capture/wp-json/`, `capture/wp-sitemap*.xml` (committed) |
| Text outlines of every page | `capture/outlines/*.txt` (committed) |
| Computed design tokens, animations, chart SVG, hover states, nav | `capture/tokens-home.json` (committed) |
| Internal link graph + off-domain references | `capture/link-graph.txt`, `capture/image-inventory.json` (committed) |

Tooling: `tools/capture.mjs`, `tools/extract-tokens.mjs`, `tools/outline.py`, `tools/crop.mjs`.

## 2. Platform

- WordPress + 10Web hosting, theme `wvc-theme` (10Web "AI builder"). Each page is a **client-side React app** (one bundle per page design: `wvc-builds/build_1654208/{Home,IndustrialSignage,RequestQuote,CorporateBranding,HospitalityEvents,CorporateGifts}.js`, ~700 KB each) rendered over Tailwind v4 + shadcn/ui components + Lucide icons + Recharts + Embla carousel.
- Static HTML pre-render is stored in `post_content`; React hydrates over it.
- 10Web Speed Optimizer (`tenweb-speed-optimizer`, vanilla-lazyload), WP emoji script.
- `<html class="dark">` forced by an inline script; the site is dark-only.

## 3. Content inventory – the site is not single-page

The REST API and sitemap are open. **23 public URLs**, not 1:

| Group | URLs | Notes |
|---|---|---|
| Home | `/` | The page described in the brief. |
| Primary pages | `/about/`, `/request-a-quote/`, `/co2-laser-specifications/` | Quote page has the only form. Specs page linked from hero "View Specifications". |
| Sector pages (Services ▾ menu) | `/industrial-labels/`, `/industrial-signage/`, `/commercial-signage/`, `/corporate-gifts/`, `/corporate-branding/`, `/hospitality/`, `/private-events/`, `/events-weddings/` | Each has its own bespoke layout. |
| Orphan pages | `/solutions/`, `/services/`, `/portfolio/` | In sitemap, not in menus; linked only from each other. `/solutions/` and `/services/` are near-duplicates. |
| CPT records | `/scenario/{material-thickness,supported-formats,maximum-bed-size}/`, `/industrial_id/{4 slugs}/`, `/header_settings/xpektrum-agency-header/` | Data records for the builder (content in `meta.wvc_*`). Their public URLs render **unstyled, broken pages** – should be 301-redirected, not migrated as pages. |

- Blog: **none** (`/wp/v2/posts` empty, no categories/tags). No privacy/legal page exists.
- Media library: **265 items**; only **94 unique images** are actually referenced by rendered pages (`image-inventory.json`).
- Nav (menu #16): Home · Services ▾ (8 sector pages above) · About · [Request a Quote] button.
- Footer nav: Industrial Signage · Hospitality Events (→ `/private-events/`) · Corporate Branding · Request a Quote.

## 4. Home page structure (as actually rendered)

Rendered order from the React `HomePage` component (differs slightly from the brief):

1. **Header** – sticky, 80 px; logo left, centred nav, orange "Request a Quote" button (radius 8 px – the only rounded element). On scroll > 20 px: `bg-background/80 + backdrop-blur + border-b white/10 + shadow`.
2. **Hero** (`#precision-laser-engineering-for-b2b`) – two columns. Eyebrow chip "↗ 80W CO2 | 0.01mm Accuracy" (mono, orange border). H1 "Industrial / Laser / **Precision**" (last word orange). Subtitle. Buttons "Start Production →" (solid orange) and "View Specifications" (outline). Right: square image `xtool-p3.jpg` (contrast-125). **"Job Complete" card** overlaps the column seam at ≥1024 px (absolute centre, hover lifts it); below the image on mobile.
3. **"The Xpektrum Industrial Edge"** (`#the-xpektrum-edge`) – eyebrow chip "Montreal Local Studio"; H2 with second line orange; paragraph; 3 stats with left border (80W / 24H / 0.01mm, mono numerals in orange); "Request a Quote" button; **Production Efficiency Metrics** card (top orange gradient bar, Recharts area chart, legend, floating "● Laser Active" badge with pulse + ping).
   - **The "marquee" is not a moving marquee.** It is a static, `aria-hidden` background texture inside this section: 20 rows of the 8 spec phrases (mono 12 px, `tracking-widest`, orange) at **5 % opacity**, alternating `translateX(-10%)` and a stepped left margin. There is no keyframe animation for it.
4. **Sector-Specific Solutions** – 3 cards (Industrial & Technical / Hospitality & Signage / Corporate Branding) with Lucide icon tile; hover: icon tile turns orange, a 2 px orange "laser line" sweeps top→bottom (`translate-y-[400px]`, 700 ms), and "View Industry Specs →" fades in. **That label is a `<span>`, not a link – the cards link nowhere today.**
5. **Our Precision Workflow** – Embla carousel of 5 steps (icon tile + number badge 01–05, title, text), active step in orange, others dimmed; prev/next buttons + 5 bar indicators; decorative blurred orange squares in the background.
6. **Recent Projects** – asymmetric 12-col grid (7/5, 5/7 spans, 16:9 and 4:5 ratios). Each item is a `<button>` opening a **dialog** with image, "MATERIAL / CLIENT" line, title and a longer description.
7. **Ready for Production?** – bordered card, pulsing map-pin icon with a cyan offset shadow, giant 160 px uppercase H2 (weight 400), "Get a Quote" / "Our Services" (→ `/industrial-signage/`).
8. **Footer** – logo + blurb; Navigation; Studio HQ (Montreal, QC, Canada · +1 (438) 898-7540 · info@xpektrum.com); Connect (LinkedIn, Instagram – **both `href="#"` placeholders**); "© 2026 Xpektrum Agency."; "● Status: Studio Online" pill (emerald ping).

### Exact data recovered from the bundle

- Chart (`Production Efficiency Metrics`, monotone area, Y 0–100 %, ticks 0/25/50/75/100):

  | Month | Xpektrum Precision (`--primary`, solid 2 px, gradient fill) | Standard Engraving (`--muted-foreground`, dashed 4 4, 1 px) |
  |---|---|---|
  | Jan | 100 | 95 |
  | Feb | 99 | 82 |
  | Mar | 100 | 70 |
  | Apr | 98 | 58 |
  | May | 99 | 45 |
  | Jun | 100 | 35 |
- Marquee phrases: `XTOOL P3 80W CO2 LASER SYSTEM`, `MONTREAL LOCAL STUDIO PRODUCTION`, `PRECISION BRUTALISM DESIGN SPECS`, `INDUSTRIAL GRADE ENGRAVING TECH`, `B2B COMMERCIAL PARTNER RELIABLE`, `0.01MM ACCURACY TOLERANCE LEVEL`, `FAST TURNAROUND PROTOTYPING 24H`, `XPEKTRUM AGENCY MONTREAL QC CA`.
- Projects (title · tag line · image · grid span/ratio · dialog description):
  1. Industrial Panel Tags · MATERIAL: ANODIZED ALUMINUM / CLIENT: HYDRO-QUEBEC · `2026/04/stainless_steel_tags.webp` · 7 col 16:9
  2. Bespoke Menu Boards · MATERIAL: RECLAIMED WALNUT / CLIENT: LE PETIT PLATEAU · `2026/05/coffee_shop_signage.webp` · 5 col 4:5
  3. Custom Branding for Corporate Gifting · MATERIAL: POWDER-COATED STEEL / CLIENT: NEXUS TECH · `2026/05/corporate_gifting_branding.webp` · 5 col 4:5
  4. Architectural Signage · MATERIAL: FROSTED ACRYLIC / CLIENT: VESTA OFFICES · `2026/04/xpektrum_office_signage.webp` · 7 col 16:9

## 5. Design tokens (computed, home page)

| Token | Value | Hex |
|---|---|---|
| `--background` | `hsl(250 35% 8%)` | `#100d1c` |
| `--foreground` | `hsl(245 38% 94%)` | `#ebeaf6` |
| `--card` | `hsl(252 28% 13%)` | `#1c182a` |
| `--secondary` / `--muted` / `--accent` | `hsl(250 22% 18%)` | `#272438` |
| `--muted-foreground` | `hsl(248 15% 58%)` | `#8884a4` |
| `--primary` | `hsl(27 85% 52%)` | `#ed7a1d` (orange) |
| `--primary-foreground` | white | `#ffffff` |
| `--border` | `hsl(0 0% 100% / .1)` | |
| `--input` | `hsl(0 0% 100% / .15)` | |
| `--destructive` | `hsl(16 70% 58%)` | |
| Glow accent (hard-coded) | `rgba(0,242,255,.3–.6)` | `#00f2ff` cyan – button hover glows, CTA icon offset shadow |
| Status dot | emerald-500 `oklch(69.6% .17 162.48)` | |
| `--radius` | `0.5rem`, but almost everything uses `rounded-none` → **square corners** (brutalist) | |

**Typography**
- Declared: `--font-sans`/`--font-default: Onest`, `--font-serif: Petrona`, `--font-mono: JetBrains Mono`.
- **Actually rendered:** only **JetBrains Mono 400/500/700** loads. The Google Fonts URLs for Onest and Petrona are malformed (`family=Onest%2C%20sans-serif`) so they 404 and text falls back to the platform sans-serif (Helvetica on macOS, Arial on Windows) and serif (Times) – the screenshots show Helvetica.
- Scale (1440 px): H1 60/66 px bold uppercase, tracking −0.05em; section H2 48 px bold uppercase −0.05em; "Recent Projects" 60 px; project H3 36 px; step H3 20 px; CTA H2 160 px weight 400; footer headings 14 px bold uppercase +0.1em; nav 12 px bold uppercase +0.1em; body 16 px, lead 20 px muted, line-height 1.625; eyebrows/labels mono 12 px uppercase `tracking-widest`.
- Spacing: Tailwind 4 px scale; sections `py-24 lg:py-32` (96/128 px); container `max-w-7xl` (1280 px) with 16/32 px gutters.

**Buttons**
- Primary: orange bg, white text, 56 px tall (hero), bold uppercase +0.05em, square; hover `bg-primary/90` + glow `0 0 20px rgba(0,242,255,.4)`; arrow icon nudges +4 px.
- Outline: transparent / white 4.5 % bg, `1px solid white/15`, hover `bg-foreground/5`.
- Header CTA: 36 px, radius 8 px, hover glow `0 0 25px rgba(0,242,255,.6)`.

**Cards**: `bg-card/40–80`, `backdrop-blur`, `1px border white/10`, no radius, large shadows.

## 6. Animations & interactions

| Effect | Implementation on live site | Ghost rebuild plan |
|---|---|---|
| Scroll reveal | IntersectionObserver (`threshold .1–.2`, once) toggling `opacity-0 translate-x-12 / scale-95` → visible, 700–1000 ms, `delay-300` | ~30 lines vanilla JS + CSS classes, honours `prefers-reduced-motion` |
| Header on scroll | class swap at `scrollY > 20` | same, passive listener |
| "Laser Active" badge | `animate-pulse` (2 s) + dot `animate-ping` (1 s) | CSS keyframes |
| Status pill dot | emerald `animate-ping` | CSS keyframes |
| CTA map pin | `animate-pulse` | CSS keyframes |
| Sector card hover | icon tile colour swap; 2 px orange line sweeps down 700 ms; "View Industry Specs →" fades in | CSS only |
| Job Complete card | hover `-translate-y-[52%]` (500 ms) | CSS only |
| Workflow carousel | Embla, prev/next + dots | CSS scroll-snap + ~40 lines JS; static 5-column grid on desktop |
| Project dialogs | Radix Dialog | native `<dialog>` + tiny JS, or link to the project post |
| Spec-phrase texture | static 5 % background text | CSS (optional slow drift, off under reduced motion) |
| Chart | Recharts SVG (~200 KB of JS) | inline SVG generated in Handlebars from theme settings / fixed path, CSS draw-in animation |

## 7. Third-party scripts, forms, contact mechanism

- **Analytics / chat / tag managers: none.** No GA, GTM, Meta pixel, Clarity, Hotjar, chat widget or reCAPTCHA found.
- External requests: Google Fonts (CSS + JetBrains Mono woff2), `s.w.org` (emoji), and **7 images hotlinked from `better-elf-dev.10web.cloud`** (10Web staging host) on `/events-weddings/` and `/co2-laser-specifications/`, plus one reference to `xpektrum.io`. These will break if the staging site is removed – they must be downloaded and re-hosted.
- **Form:** the only form is on `/request-a-quote/` ("Materialize Vision"): fields `name`* (text), `email`* (email), `phone`* (tel), `project_type` (select: Industrial Labeling / Hospitality Signage / Corporate Branding / Custom Fabrication), `project_details`* (textarea). Submit "Initialize Quote Request"; success message "Transmission successful. Our production team is reviewing your specifications and will contact you shortly." It posts via `wvcClient.formSubmission` to **10Web's own builder backend** (entries stored in WP). This does not exist in Ghost → a replacement is required (see questions).
- All other CTAs are plain links to `/request-a-quote/`. Phone and email are shown as text, not `tel:`/`mailto:` links.

## 8. SEO / metadata (current)

- `<title>` only ("Xpektrum Agency" on home); **no meta description, no OpenGraph/Twitter tags, no JSON-LD**, canonical present, favicon `2026/04/cropped-logo.png`.
- robots.txt standard WP; sitemap includes the broken CPT URLs.

## 9. Defects and inconsistencies found on the live site

1. Broken internal links (404): `/CorporateBrandingPage`, `/CorporateGiftsPage`, `/HospitalityEventsPage`, `/HospitalityPage`, `/IndustrialLabelsPage`, `/IndustrialSignagePage` (on `/services/`, `/solutions/`, `/private-events/`).
2. Social links are `#` placeholders.
3. Phone mismatch: `/solutions/` footer shows **+1 (514) 555-0198** (a 555 placeholder) vs **+1 (438) 898-7540** everywhere else.
4. Bed-size mismatch: scenario "Maximum Bed Size" says **600 × 400 mm**, `/co2-laser-specifications/` says **700 × 500 mm**.
5. `/industrial-signage/` contains template filler ("AI-Powered Detection", "IoT Integration").
6. Typo "CONTAT" on the quote page; "Industrial   Signage" title has stray whitespace.
7. Fonts Onest/Petrona never load (malformed URLs).
8. CPT URLs render as unstyled pages.
9. Accessibility: white on orange buttons = **2.84:1** (fails AA 4.5:1); `/hospitality/` hero white headline over a light photo; dimmed workflow steps; phone/email not linked; projects' only content is in a dialog.
10. Image licensing to confirm: hero `xtool-p3.jpg` is xTool marketing art ("The Ultimate Cutting King"); many sector images are Vecteezy stock (`vecteezy_*`) and Etsy/Amazon product shots (`il_fullxfull.*`, `71DyzSlz7jL.jpg`).

Contrast of main pairs: foreground/bg 16.1:1 ✓ · muted/bg 5.4:1 ✓ · muted/card 4.9:1 ✓ · orange text/bg 6.8:1 ✓ · **white/orange 2.8:1 ✗** · bg-colour text on orange 6.8:1 ✓.

## 10. Proposed Ghost content model

| Live content | Ghost object | Editable where |
|---|---|---|
| Home | Page `home` with template `custom-home.hbs`, set as the site's home via routes.yaml (`/: data: page.home`) | Hero title/subtitle/eyebrow → page title, custom excerpt, theme settings; Job-complete card and stats → theme settings |
| 3 stats, chart values, workflow steps, marquee phrases, status text | `package.json` → `config.custom` (Design → Site-wide / Homepage) — limited to Ghost's 20-setting cap, so stats/steps use compact `"80W|Industrial Power|text"` strings | Ghost Admin → Design |
| Sector cards (3 on home) | Pages tagged `#sector` (internal tag), title + custom excerpt + icon via tag/slug; "View Industry Specs →" becomes a **real link** to the matching sector page | Ghost editor |
| Sector pages (8) + about, specs, solutions, services, portfolio | Ghost pages with the same slugs; content as Lexical HTML cards using theme utility classes; templates `custom-sector.hbs`, `page.hbs` | Ghost editor |
| Recent projects (4) | Posts tagged `project`; custom excerpt = "MATERIAL / CLIENT" line; feature image + alt; body = dialog description; `/projects/<slug>/` | Ghost editor |
| Industry specs (`scenario`, `industrial_id` CPTs, 7 records) | Posts tagged `#spec` (internal) rendered as sections on sector/spec pages via `{{#get}}`; old URLs 301 → owning page | Ghost editor |
| Quote page | Page `request-a-quote`, template `custom-quote.hbs` with form (backend per your choice) | Ghost editor + theme setting for form endpoint |
| Nav / footer nav | Ghost primary + secondary navigation (Ghost has no dropdowns → "Services" dropdown is built from the `#sector` pages in the theme) | Settings → Navigation |
| Contact details, social URLs | Ghost settings (title, description, logo, Facebook/X not used) + theme settings `phone`, `email`, `address`, `linkedin_url`, `instagram_url` | Design |
| Redirects | `redirects.json`: CPT URLs → owning pages, broken `*Page` routes → real pages | Settings → Labs |

Images: download the 94 referenced images (original files, `-scaled` resolved to the real originals where WP kept them) + logos/favicon; convert to WebP (AVIF where smaller), keep alt text; Ghost generates responsive sizes via `image_sizes` in package.json.

## 11. Decisions (2026-10-13)

- Scope: all 15 public pages are migrated with unchanged URLs; CPT record URLs and broken `*Page` routes get 301s.
- Quote form: hosted form service (Formspree-compatible POST endpoint configured as a theme setting), same fields, validation and success copy.
- Contrast: primary buttons keep `#ed7a1d` with dark text `#100d1c` (6.8:1).
- Fonts: match the rendered look (system sans stack: Helvetica Neue / Helvetica / Arial) plus self-hosted JetBrains Mono 400/500/700.

## 12. Phase 2 – content export (as built)

- `tools/download-images.mjs` → `tools/optimize-images.mjs` → `tools/capture-interactive.mjs` → `tools/build-content.mjs` → `tools/package-import.sh`.
- Pages keep their live slugs. Home is a page rendered by `custom-home.hbs` via `routes.yaml`. The other 14 pages hold their cleaned, post-hydration markup in a single Lexical **HTML card** (`.xp-legacy` wrapper), with images re-pointed to Ghost and links made relative. The theme supplies the CSS and the small JS for tabs, accordions, dialogs and the quote form. Text is editable in the HTML card. The home page, projects and site settings are native Ghost content.
- Featured home sector cards = pages tagged `#sector-featured` (card title = OG title, card text = custom excerpt): `/industrial-signage/`, `/private-events/`, `/corporate-branding/`, the same three linked in the live footer.
- CPT records are not separate Ghost objects. Scenario data already renders on `/industrial-signage/`, and the 3 unused `industrial_id` hero variants are archived in `content-export/unused/wp-cpt-records.json`. Their URLs 301 to `/industrial-signage/`.
- AVIF: the theme requests AVIF from Ghost's image pipeline (`{{img_url format="avif"}}`) inside `<picture>`, so only WebP sources are stored.
