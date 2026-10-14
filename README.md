# laser.xpektrum.com on Ghost 6

This repo rebuilds the WordPress/10Web site at https://laser.xpektrum.com/ as a Ghost 6 site. It contains:

- a custom theme (`theme/xpektrum-laser`),
- the migrated content (`content-export/`),
- a Docker Compose stack (Ghost 6 + MySQL 8.0, plus Caddy in production) that installs everything with one command.

| Path | What |
|---|---|
| `Makefile` | Entry point: `make help` |
| `ghost-migration/compose.yaml` | `ghost:6-alpine` (major 6), `mysql:8.0`, one-shot `ghost-init`, `caddy:2-alpine` (production profile) |
| `ghost-migration/scripts/bootstrap.sh` | Idempotent setup: owner account, theme, content, routes, redirects, settings, 24 checks |
| `theme/xpektrum-laser/` | Theme. Bind-mounted read-only into Ghost |
| `content-export/` | `ghost-import.json`, optimized WebP images, `redirects.json`, `routes.yaml` |
| `tools/` | Capture, content build, visual diff, link check |
| `docs/audit.md`, `docs/status.md` | Audit of the live site, project status and verification results |

## Run locally

You need Docker with Compose v2, plus `jq`, `curl` and `zip`. Node 20+ is only needed to rebuild the theme or content.

```sh
make env          # creates ghost-migration/.env – set passwords and GHOST_ADMIN_EMAIL/PASSWORD
make up import    # start MySQL + Ghost, then bootstrap; ends with "all checks passed"
```

Open http://localhost:2368. Ghost Admin is at http://localhost:2368/ghost/, with the credentials from `.env`.

`make import` is safe to re-run. After the first import, a re-run only checks the site; it never reverts edits made in Ghost Admin. Two targets go further:

- `make sync-settings` re-applies routes, redirects, navigation, site settings and the theme settings from `.env`. This overwrites Admin edits to those.
- `make reimport` wipes posts, pages and tags, imports again and re-applies settings. Staff accounts are kept.

## Where content lives

| What | Edit in |
|---|---|
| Hero, edge and CTA text, Job Complete card, spec phrases, phone/email/address, social URLs, quote form endpoint | Ghost Admin → Settings → Design → Site-wide |
| Home stats (80W, 24H, 0.01mm) | Posts tagged `#stat` |
| Workflow steps | Posts tagged `#workflow` |
| Recent projects (`/projects/<slug>/`) | Posts tagged `project` |
| Home sector cards | Pages tagged `#sector-featured` (card title = Facebook/OG title, card text = excerpt) |
| The other 14 pages | Each page holds one HTML card with the migrated markup. Edit the text in place; the theme supplies the CSS and JS |
| Menus | Settings → Navigation. The "Services" dropdown lists the pages tagged `#sector` |
| Redirects / routes | Settings → Labs (sources in `content-export/`) |

The quote form posts to a Formspree-compatible endpoint set in Design → **Quote form endpoint**. Until one is set, submitting opens a pre-filled email to the address in the email setting.

### Theme development

```sh
npm ci
npm run watch:css      # Tailwind 4 → assets/built/screen.css
npm run build          # CSS + JS
make check             # gscan + compose + bootstrap syntax
docker compose -f ghost-migration/compose.yaml restart ghost   # Ghost caches .hbs templates in production mode
```

`npm run content` rebuilds `ghost-import.json` from the Phase 1 capture (`capture/`). The capture is gitignored, so this only works on the machine that ran the capture. The build is reproducible: the same input gives byte-identical JSON. `make theme` packages `theme/xpektrum-laser.zip` for uploading to another Ghost instance.

## Deploy to production (Caddy + Let's Encrypt)

You need a Linux VM with Docker and Compose v2, `jq`, `curl`, `zip` and `make`, and ports 80 and 443 open.

1. Clone the repo and run `make env`. In `ghost-migration/.env` set:
   - `GHOST_URL=https://laser.xpektrum.com`, `DOMAIN=laser.xpektrum.com`, `ACME_EMAIL`
   - `COMPOSE_PROFILES=production` (uncomment it, so the `make` targets also run Caddy)
   - strong `MYSQL_*` and `GHOST_ADMIN_PASSWORD` values (`openssl rand -base64 24`)
   - real SMTP settings
   - `QUOTE_FORM_ENDPOINT`, `LINKEDIN_URL`, `INSTAGRAM_URL`. These are applied on the first import. Change them later in Design, or with `make sync-settings`.

   Keep `GHOST_BIND=127.0.0.1`, so Ghost is only reachable through Caddy and by bootstrap on the host.
2. `chmod 600 ghost-migration/.env && make up import`
3. Once SMTP works, set `STAFF_DEVICE_VERIFICATION=true` and run `make up` again.
4. The Caddyfile also redirects `www.laser.xpektrum.com`. Either create that DNS record (CNAME to `laser.xpektrum.com`), or delete the `www.` block. Otherwise Caddy keeps retrying a certificate it can't get.

Caddy can only get a certificate after DNS points at the server, so do the cutover below in this order.

## DNS cutover for laser.xpektrum.com

1. **A day before:** write down the current DNS records for `laser.xpektrum.com`; you need them to roll back. Lower the record's TTL to 300 s.
2. **Rehearse:** deploy to the new server and run `make up import` with the production `.env`. Test without touching public DNS:
   ```sh
   curl -sI --resolve laser.xpektrum.com:80:<SERVER_IP> http://laser.xpektrum.com/
   ```
   Or add `<SERVER_IP> laser.xpektrum.com` to your `/etc/hosts`. TLS isn't issued yet at this point, so check the pages over plain HTTP, or temporarily set `DOMAIN`/`GHOST_URL` to a staging subdomain that already points at the server. Ghost stores links relative to its URL, so changing `GHOST_URL` later is safe.
3. **Cut over:** point the `A`/`AAAA` record for `laser.xpektrum.com` at the new server. Caddy gets the certificate within a minute of DNS resolving. Check it with `docker compose -f ghost-migration/compose.yaml logs caddy`.
4. **Verify:** run `make import` (on an existing install it only runs the checks). Then run `node tools/link-check.mjs https://laser.xpektrum.com/` and spot-check `/home/`, `/scenario/maximum-bed-size/` and `/CorporateBrandingPage` (all should 301). Submit `https://laser.xpektrum.com/sitemap.xml` in Google Search Console.
5. Keep the 10Web site live for at least a week, as the rollback target. After that, raise the TTL again.

## Backup and restore

```sh
make backup                                              # → ghost-migration/backups/<timestamp>/{ghost-db.sql.gz, ghost-content.tar.gz}
make restore BACKUP=ghost-migration/backups/<timestamp>  # stops Ghost, loads the dump, restores content/, starts again
```

A backup is a consistent `mysqldump` plus Ghost's `content/` folder (images, files, settings), without the bind-mounted theme. Backups are gitignored. Schedule them and copy them off the server, for example with a crontab entry:

```cron
15 3 * * * cd /srv/xpektrum-laser-ghost && make backup >/var/log/xpektrum-backup.log 2>&1 && find ghost-migration/backups -mindepth 1 -maxdepth 1 -mtime +14 -exec rm -r {} +
```

The backup/restore round-trip was tested: change the DB, restore, and both the DB and the images came back.

## Upgrades

- **Ghost 6.x (minor/patch):** run `make backup`, then `docker compose -f ghost-migration/compose.yaml pull ghost && make up`. Ghost runs its DB migrations on start. Check with `make import` (only runs the checks).
- **Ghost 7 (major):** read the release notes and check the theme with the gscan release for that version (`npx gscan@latest theme/xpektrum-laser`). Change the image to `ghost:7-alpine` on a staging copy (restore a backup there) before production.
- **MySQL** stays on `8.0`. Never use `latest`, and don't jump majors without a dump/restore test.
- **Theme:** `git pull` and `docker compose -f ghost-migration/compose.yaml restart ghost`.

## Rollback

- **Bad upgrade:** Ghost DB migrations are not reversible. Pin the previous image tag in compose.yaml (for example `ghost:6.70-alpine`), then run `make restore BACKUP=<backup taken before the upgrade>`.
- **Bad content or settings change:** run `make restore` with the latest good backup.
- **Bad cutover:** point the DNS record back to the 10Web values you wrote down. With TTL 300, traffic returns within minutes.

## Troubleshooting

- **Ghost restarts in a loop on a fresh volume** with `tar: can't create symlink 'casper'`: this is the problem `ghost-init` exists for. Check it ran: `docker compose ps -a` should show it `Exited (0)`.
- **"login needs email verification"** during bootstrap: set `STAFF_DEVICE_VERIFICATION=false` until SMTP works.
- **Template changes don't show:** restart Ghost (it caches templates in production mode).
- **Second stack on the same machine** (for example to test a clean install): put `COMPOSE_PROJECT_NAME`, `GHOST_PORT` and `GHOST_URL` in another env file, then run `make up import ENV_FILE=/path/to/that.env`.
