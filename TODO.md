# TODO / open items

## Decisions needed from owner
- [x] Quote form backend → hosted form service (Formspree-compatible endpoint in a theme setting). Owner still needs to create the form and supply the endpoint URL.
- [x] Scope → migrate all 15 public pages. CPT record URLs get 301s.
- [x] Orange buttons → keep the orange and use dark text (#100d1c, 6.8:1).
- [ ] Real LinkedIn / Instagram URLs (live site uses `#`).
- [ ] Correct bed size: 600×400 mm (scenario) vs 700×500 mm (specs page).
- [ ] Confirm image licences (xTool marketing hero, Vecteezy stock, Etsy/Amazon product photos).
- [ ] Remove the "AI-Powered Detection / IoT Integration" filler on /industrial-signage/?

## Phase 1 – capture
- [x] Playwright capture 23 URLs × 3 widths, assets, rendered HTML
- [x] WP REST + sitemap inventory
- [x] Tokens, animations, chart data, nav, form analysis
- [ ] Lighthouse baseline of live site (home + one sector page). Deferred to Phase 5, while the site is still live.

## Data fixes applied during migration (planned)
- Normalise phone to +1 (438) 898-7540 (drop 514-555-0198 placeholder)
- Fix "CONTAT" typo, "Industrial   Signage" whitespace
- Re-host 7 images hotlinked from better-elf-dev.10web.cloud and 1 from xpektrum.io
- 301 the CPT URLs and the 6 broken `/…Page` routes
