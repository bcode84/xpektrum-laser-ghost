# TODO / open items

## Decisions needed from owner
- [x] Quote form backend → hosted form service (Formspree-compatible endpoint in a theme setting). Owner still needs to create the form and supply the endpoint URL.
- [x] Scope → migrate all 15 public pages. CPT record URLs get 301s.
- [x] Orange buttons → keep the orange and use dark text (#100d1c, 6.8:1).
- [ ] Real LinkedIn / Instagram URLs (live site uses `#`).
- [ ] Formspree (or compatible) endpoint for the quote form, and SMTP credentials.
- [ ] /commercial-signage/ hero photo: shown in the rebuild, never rendered on the live site (uncompiled Tailwind class). Keep or remove?
- [ ] /solutions/ was cyan-themed on the live site; the rebuild uses the site-wide orange theme.
- [ ] Correct bed size: 600×400 mm (scenario) vs 700×500 mm (specs page).
- [ ] Confirm image licences (xTool marketing hero, Vecteezy stock, Etsy/Amazon product photos).
- [ ] Remove the "AI-Powered Detection / IoT Integration" filler on /industrial-signage/?
- [ ] /hospitality/ gallery subtitle is in Dutch ("Ontdek onze maatwerkoplossing…"). Translate it?

## Phase 1 – capture
- [x] Playwright capture 23 URLs × 3 widths, assets, rendered HTML
- [x] WP REST + sitemap inventory
- [x] Tokens, animations, chart data, nav, form analysis
- [x] Lighthouse baseline of live site (home + /industrial-signage/), see docs/status.md

## Data fixes applied during migration (planned)
- Normalise phone to +1 (438) 898-7540 (drop 514-555-0198 placeholder)
- Fix "CONTAT" typo, "Industrial   Signage" whitespace
- Re-host 7 images hotlinked from better-elf-dev.10web.cloud and 1 from xpektrum.io
- 301 the CPT URLs and the 6 broken `/…Page` routes

## Phase 2 – content model & export
- [x] 99 referenced images downloaded as originals (141 MB) → WebP (10.9 MB), alt text kept (content-export/images/manifest.json)
- [x] Tab/accordion/dialog content recovered (capture/interactive.json)
- [x] ghost-import.json: 15 pages, 4 project posts, tags, posts_meta, settings, navigation
- [x] redirects.json (13 rules), routes.yaml (home page route, /projects/ collection)
- [x] Validate the import against a running Ghost 6 (clean-room install, Ghost 6.70, 24/24 checks)
- [x] Media-library archive (all 265 originals) → content-export/media-library-archive/ (local only, not imported)
