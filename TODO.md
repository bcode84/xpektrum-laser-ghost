# TODO / open items

## Decisions needed from owner
- [ ] Quote form backend (live form posts to 10Web's builder backend, which Ghost lacks).
- [ ] Scope: migrate all 15 public pages vs. home only (see docs/audit.md §3).
- [ ] Orange buttons: white text is 2.84:1 (fails WCAG AA). Keep the exact look, or fix contrast?
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
