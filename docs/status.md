# Status – resumable checkpoint

Last updated: 2026-10-13. Update this file after every step so a cut-off can resume.

## Audit snapshot (Step 1)

- Repo: 4 commits (`1170d5d` Phase 1 → `ce1934d` Phase 3/4). The staged but uncommitted work is Phase 5 visual-diff tooling plus chart and container CSS fixes.
- Stack: `xpektrum-db-1` (mysql:8.0) and `xpektrum-ghost-1` (ghost:6-alpine → **Ghost 6.70**) are both running and healthy on `127.0.0.1:2368`. The theme is active and content is imported.
- Checks: `npx gscan` reports "compatible with Ghost 6.x" with 0 errors and 0 warnings. `docker compose config` passes for both the default and production profiles. `bash -n` passes on both shell scripts and `node --check` on all JS. The import JSON is valid.
- Placeholders: grep found no TODO, FIXME or lorem in the theme, tools or import. The only empty files are the WordPress REST `posts.json` and `tags.json` (`[]`, since the site has no blog).

## Status per phase

| Phase | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 Capture | Screenshots 23 URLs × 1440/768/390 | DONE | `capture/pages/<slug>/full-<w>.png` (local, gitignored) |
| | Rendered HTML, CSS, JS, fonts, images | DONE | `capture/pages/*/rendered.html`, `capture/assets/` (172 files), `asset-index.json` |
| | Design tokens, animations, chart data | DONE | `capture/tokens-home.json`, `docs/audit.md` §4–6 |
| | Lighthouse baseline of live site | DONE | `docs/lighthouse/live-*.json` |
| 2 Export | Ghost import JSON | DONE | 15 pages, 12 posts (4 projects, 3 `#stat`, 5 `#workflow`), 6 tags, 19 posts_meta, 13 settings |
| | Images | DONE | 98 WebP in `content-export/images/optimized/`, `images.zip` (10.9 MB), `ghost-import.zip` (104 files) |
| | redirects.json / routes.yaml | DONE | 13 rules; home route, `/projects/` collection. Verified live: `/home/`, `/scenario/*`, `/CorporateBrandingPage` → 301 |
| 3 Theme | Templates | DONE | default, index, page, post, tag, error, custom-home/-sector/-quote/-full-width |
| | Partials: marquee, chart, stats, workflow, sectors, projects, footer, JSON-LD | DONE | `partials/` (84 files incl. 66 icons). Chart rework staged, not committed |
| | gscan | DONE | 0 errors, 0 warnings |
| 4 Docker | compose.yaml (ghost:6-alpine, mysql:8.0, healthchecks, volumes, theme bind mount :ro, Caddy profile) | DONE | 92 lines, `config -q` OK |
| | .env.example, .gitignore (`.env` ignored, not tracked) | DONE | |
| | scripts/bootstrap.sh (idempotent: up, wait, owner, theme, import, routes, redirects, settings, 24 checks) | DONE | 164 lines; ran successfully against the current stack |
| | Makefile `up` / `import` / `reset` / `backup` (+ `restore`, `reimport`, `sync-settings`) | DONE | 564154c; backup and restore round-trip tested |
| | Clean-room run (fresh volumes) | DONE | found and fixed a crash loop (a96a32c) |
| 5 Verify | Visual diff | DONE | 15 pages × 3 widths, outliers explained below |
| | Lighthouse home + project page | DONE | 98–100 in every category |
| | Internal link / image check | DONE | 0 broken |
| | README.md (local, Caddy deploy, DNS cutover, backup/restore, upgrade, rollback) | DONE | |

### Visual diff at 1440 px (`visual-diff/report.json`)

All pages are below 3 % pixel mismatch except `commercial-signage` (8.45 %). The +249 px on the 7 sector pages comes from the intentional "Other sectors" link strip in `custom-sector.hbs`. That strip is not a regression. To look at: `commercial-signage` 8.45 % and `solutions` −90 px.

## Bugs found in finished work

1. compose.yaml and .env.example tell users to run `make up && make import`, but there is no Makefile. Fix: add one.
2. `tools/visual-diff.mjs` overwrites `report.json` on every run, which lost the home results. Fix: merge results by slug and width.
3. `bootstrap.sh` always sources `./.env`, so it can't verify a throwaway clean install next to the dev stack. Fix: optional `ENV_FILE`. The compose project name and port come from that file.
4. Cosmetic: compose.yaml says "6.69.0", but Ghost 6.70 is now running. The `6-alpine` tag floats within major 6, as intended. Fix: reword the comment.

## Remaining work, by priority

| # | Item | Size |
|---|---|---|
| 1 | Commit the staged Phase 5 tooling and chart/container fixes | S |
| 2 | Makefile: `up`, `import`, `reset`, `backup`, plus `restore`, `down`, `logs`, `theme` | S |
| 3 | bootstrap `ENV_FILE` support, then a clean-room `make up && make import` on a throwaway project/port | M |
| 4 | Visual diff at 768 and 390 for every page; fix `commercial-signage` and `solutions` deltas | M |
| 5 | Lighthouse: home and `/projects/industrial-panel-tags/` (local), plus a live baseline for comparison | S |
| 6 | Crawl the local site for broken internal links and images | S |
| 7 | README.md: local run, production with Caddy, DNS cutover, backup/restore, upgrade, rollback | M |
| 8 | Sync TODO.md | S |

## Owner decisions still open (none block the build)

- Quote form endpoint (Formspree-compatible URL). Until it is set, submitting opens a pre-filled email to info@xpektrum.com.
- Real LinkedIn and Instagram URLs.
- SMTP credentials (staff invites and password resets).
- Bed size: 600×400 mm or 700×500 mm. Image licences. Filler text on /industrial-signage/. Dutch subtitle on /hospitality/.

## Progress log

- [x] Step 1 audit, Step 2 this file
- [x] 3.1 Committed staged chart/container fixes and visual-diff tooling (05462bc, 48de98e)
- [x] 3.1/3.2 Phase 2 export and theme templates needed no changes (import valid, gscan clean)
- [x] 3.3 Makefile (564154c). Bootstrap: ENV_FILE, and zips the committed JSON instead of rebuilding from the capture (18f9e97)
- [x] 3.4 Clean-room install on a throwaway project (port 2369) found a **crash loop on fresh volumes** (root-owned content/themes); fixed with the ghost-init service (a96a32c). After the fix: `make up && make import` passes 24/24 checks, a re-run is a no-op, and backup → mutate → restore brings back both the DB and the images
- [x] 3.5a Visual diff, 15 pages × 1440/768/390 (`visual-diff/report.json`; heights at 390 are device px, DPR 2). 36 of 45 captures are under 3 % mismatch. Every outlier was inspected; none is a layout regression:
  - Sector pages +249 px at 1440 (+351 CSS px at 390): the intentional "Other sectors" link strip.
  - `private-events`/`events-weddings`/`hospitality` @390 (27 % / 20 % / 5 %): the live hero background is a 10-second opacity `pulse` layer behind 10Web's lazy background loader, so the screenshots catch different frames. Layout is identical.
  - `home` @390 (6.9 %): 1–2 px text baseline offsets plus the deliberate dark text on orange buttons (contrast decision).
  - `commercial-signage` (8 %): the live hero uses `bg-[url(...)]`, which the 10Web Tailwind build never compiled, so live visitors see no photo. The rebuild shows the photo the author intended. **Owner: keep it or remove it** (one line in the page's HTML card).
  - `solutions` (−90 px, 3–6 %): the live orphan page has its own cyan palette and header. The migration normalised it to the site's orange theme and shared header.
  - Fixed in the tool: `scroll-behavior: smooth` left full-page shots mid-scroll (sticky header drawn mid-page). The tool now scrolls with `behavior: 'instant'`, and `report.json` merges instead of being overwritten.
- [x] 3.5b Lighthouse (`docs/lighthouse/*.json`, mobile, local Docker vs live):

  | Page | Perf | A11y | BP | SEO | LCP | CLS | Weight |
  |---|---|---|---|---|---|---|---|
  | Ghost `/` | 99 | 100 | 100 | 100 | 2.2 s | 0 | 382 KiB |
  | Ghost `/projects/industrial-panel-tags/` | 98 | 100 | 100 | 100 | 2.3 s | 0 | 288 KiB |
  | Ghost `/industrial-signage/` | 98 | 98 | 100 | 100 | 2.2 s | 0 | 532 KiB |
  | Live `/` | 58 | 92 | 96 | 92 | 19.5 s | 0 | 6,521 KiB |
  | Live `/industrial-signage/` | 84 | 89 | 96 | 92 | 3.5 s | 0 | 532 KiB |

  Fixed along the way: CLS 0.11 on project pages (reserved 4:3 frame), carousel-dot touch targets, 6 nameless inert chevron buttons and orange text at 3.8:1 in migrated content (6b7d5da, 085f22b). Remaining: one `heading-order` skip inside migrated legacy markup on /industrial-signage/.
- [x] 3.5c Link/image crawl (`tools/link-check.mjs` → `docs/link-check.json`): 18 pages, 134 assets, 0 broken. `/services/` and `/projects/` are reachable only via the sitemap (`/services/` was an orphan on the live site too)
- [x] 3.6 README.md: local run, content map, Caddy deploy, DNS cutover, backup/restore, upgrades, rollback, troubleshooting
- [x] Bootstrap: re-runs no longer re-apply routes, redirects, navigation and settings, which would have reverted Admin edits in production. They are now applied only with an import, or via `make sync-settings`

## Done. What's left is manual (owner)

See "Owner decisions" above. Plus: create the Formspree form, configure SMTP, choose the production host, run the DNS cutover (README), and make the commercial-signage hero-photo call.
