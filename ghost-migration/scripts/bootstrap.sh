#!/usr/bin/env bash
# Bootstrap the Xpektrum Ghost site: start the stack, create the owner, activate the theme, import content
# and images, upload routes/redirects, apply settings and print a verification report.
# Idempotent: safe to re-run. Content is imported only once unless FORCE_IMPORT=1 (which wipes Ghost content first).
#
# Usage: scripts/bootstrap.sh            (from ghost-migration/, or `make import` from the repo root)
#        FORCE_IMPORT=1 scripts/bootstrap.sh
#        ENV_FILE=other.env scripts/bootstrap.sh   (e.g. a throwaway stack: COMPOSE_PROJECT_NAME + GHOST_PORT in that file)
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
EXPORT="$ROOT/content-export"
cd "$HERE"

ENV_FILE="${ENV_FILE:-.env}"
[ -f "$ENV_FILE" ] || { echo "Missing ghost-migration/$ENV_FILE (copy .env.example)"; exit 1; }
# Exported, so `docker compose` below sees the same values (shell env beats the .env file).
set -a; . "$ENV_FILE"; set +a

GHOST_URL="${GHOST_URL%/}"
API_BASE="http://127.0.0.1:${GHOST_PORT:-2368}"
ADMIN="$API_BASE/ghost/api/admin"
HOST_HEADER="$(echo "$GHOST_URL" | sed -E 's#^https?://##; s#/.*$##')"
PROTO="$(echo "$GHOST_URL" | sed -E 's#://.*##')"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

c_ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
c_info() { printf '\033[36m▸\033[0m %s\n' "$*"; }
c_fail() { printf '  \033[31m✘\033[0m %s\n' "$*"; }

# curl against the local Ghost port while presenting the public URL (Ghost checks Host/Origin/proto).
api() {
    local method="$1" path="$2"; shift 2
    curl -sS -X "$method" "$ADMIN$path" -b "$JAR" -c "$JAR" \
        -H "Host: $HOST_HEADER" -H "Origin: $GHOST_URL" -H "X-Forwarded-Proto: $PROTO" \
        -H "Accept-Version: v6.0" "$@"
}
api_json() { local m="$1" p="$2" d="$3"; shift 3; api "$m" "$p" -H 'Content-Type: application/json' --data "$d" "$@"; }

# ---------------------------------------------------------------- 1. stack
c_info "Starting stack (docker compose up -d --wait)"
docker compose up -d --wait >/dev/null 2>&1 || { docker compose ps; exit 1; }
c_ok "db and ghost healthy"

# ---------------------------------------------------------------- 2. content package
# ghost-import.json and the optimized images are committed; the zip is not. (Regenerating the JSON itself
# needs the local Phase 1 capture: `npm run content`.)
if [ ! -f "$EXPORT/ghost-import.zip" ]; then
    c_info "Packaging content import"
    command -v zip >/dev/null || { echo "zip is required to package the import"; exit 1; }
    "$ROOT/tools/package-import.sh" "$ROOT" >/dev/null
fi
[ -f "$ROOT/theme/xpektrum-laser/assets/built/screen.css" ] || { echo "Theme not built: run 'npm run build' in the repo root"; exit 1; }

# ---------------------------------------------------------------- 3. owner account
c_info "Staff account"
if api GET /authentication/setup/ | grep -q '"status":true'; then
    c_ok "already set up"
else
    payload=$(jq -n --arg n "$GHOST_ADMIN_NAME" --arg e "$GHOST_ADMIN_EMAIL" --arg p "$GHOST_ADMIN_PASSWORD" --arg t "${GHOST_SITE_TITLE:-Xpektrum Agency}" \
        '{setup:[{name:$n,email:$e,password:$p,blogTitle:$t}]}')
    out=$(api_json POST /authentication/setup/ "$payload")
    echo "$out" | grep -q '"users"' && c_ok "owner $GHOST_ADMIN_EMAIL created" || { c_fail "setup failed: $out"; exit 1; }
fi

out=$(api_json POST /session/ "$(jq -n --arg u "$GHOST_ADMIN_EMAIL" --arg p "$GHOST_ADMIN_PASSWORD" '{username:$u,password:$p}')" -o /dev/null -w '%{http_code}')
case "$out" in
    201|200) c_ok "signed in" ;;
    403) c_fail "login needs email verification (STAFF_DEVICE_VERIFICATION=true). Set it to false for bootstrap, or verify the device in Ghost Admin first."; exit 1 ;;
    *) c_fail "login failed (HTTP $out) – check GHOST_ADMIN_EMAIL/PASSWORD in .env"; exit 1 ;;
esac

# ---------------------------------------------------------------- 4. theme
c_info "Theme"
out=$(api PUT /themes/xpektrum-laser/activate/)
echo "$out" | grep -q '"active":true' && c_ok "xpektrum-laser active" || { c_fail "theme activation failed: $(echo "$out" | head -c 400)"; exit 1; }

# ---------------------------------------------------------------- 5. content import
c_info "Content"
has_home() { [ "$(api GET '/pages/slug/home/?fields=id' -o /dev/null -w '%{http_code}')" = "200" ]; }
if has_home && [ "${FORCE_IMPORT:-0}" != "1" ]; then
    c_ok "already imported (FORCE_IMPORT=1 to wipe and re-import)"
else
    # Remove Ghost's fixture content ("Coming soon", "About this site" – which would take the /about/ slug),
    # or the previous import when FORCE_IMPORT=1. Staff, settings and themes are kept.
    code=$(api DELETE /db/ -o /dev/null -w '%{http_code}')
    [ "$code" = "204" ] && c_ok "existing posts/pages/tags removed" || { c_fail "content wipe HTTP $code"; exit 1; }
    out=$(api POST /db/ -F "importfile=@$EXPORT/ghost-import.zip;type=application/zip")
    if echo "$out" | grep -q '"problems"\|"db"'; then
        c_ok "import accepted"
        echo "$out" | jq -r '.problems[]? | "    note: \(.message // .help) \(.context // "")"' 2>/dev/null | head -20 || true
    else
        c_fail "import failed: $(echo "$out" | head -c 600)"; exit 1
    fi
    # Large imports run in the background; wait for the home page to appear.
    for _ in $(seq 1 60); do has_home && break; sleep 2; done
    has_home && c_ok "content present" || { c_fail "home page not found after import"; exit 1; }
fi

# ---------------------------------------------------------------- 6. routes & redirects
c_info "Routes and redirects"
code=$(api POST /settings/routes/yaml/ -F "routes=@$EXPORT/routes.yaml;type=application/x-yaml" -o /dev/null -w '%{http_code}')
[ "$code" = "200" ] && c_ok "routes.yaml uploaded" || { c_fail "routes upload HTTP $code"; exit 1; }
code=$(api POST /redirects/upload/ -F "redirects=@$EXPORT/redirects.json;type=application/json" -o /dev/null -w '%{http_code}')
[ "$code" = "200" ] && c_ok "redirects.json uploaded" || { c_fail "redirects upload HTTP $code"; exit 1; }

# ---------------------------------------------------------------- 7. settings
c_info "Settings"
settings=$(jq --arg url "$GHOST_URL" '{settings: [.db[0].data.settings[] | .value |= (if type == "string" then gsub("__GHOST_URL__"; "") else . end)]}' "$EXPORT/ghost-import.json")
out=$(api_json PUT /settings/ "$settings")
echo "$out" | grep -q '"settings"' && c_ok "site settings + navigation applied" || { c_fail "settings failed: $(echo "$out" | head -c 400)"; exit 1; }

current=$(api GET /custom_theme_settings/)
custom=$(echo "$current" | jq --arg q "${QUOTE_FORM_ENDPOINT:-}" --arg li "${LINKEDIN_URL:-}" --arg ig "${INSTAGRAM_URL:-}" '
    {custom_theme_settings: [.custom_theme_settings[] | {key, value}
        | if .key == "quote_form_endpoint" and $q != "" then .value = $q
          elif .key == "linkedin_url" and $li != "" then .value = $li
          elif .key == "instagram_url" and $ig != "" then .value = $ig
          else . end]}')
out=$(api_json PUT /custom_theme_settings/ "$custom")
echo "$out" | grep -q '"custom_theme_settings"' && c_ok "theme settings applied" || { c_fail "theme settings failed: $(echo "$out" | head -c 400)"; exit 1; }

# ---------------------------------------------------------------- 8. verification report
c_info "Verification ($GHOST_URL)"
BODY="$(mktemp)"
public() { curl -s -o "$BODY" -w '%{http_code} %{redirect_url}' -H "Host: $HOST_HEADER" -H "X-Forwarded-Proto: $PROTO" "$API_BASE$1"; }
fails=0
# check <path> <status> [text that must appear in the response]
check() {
    local path="$1" want="$2" text="${3:-}" got
    got=$(public "$path")
    if [ "${got%% *}" != "$want" ]; then c_fail "$path → $got (expected $want)"; fails=$((fails + 1)); return; fi
    if [ -n "$text" ] && ! grep -qiF "$text" "$BODY"; then c_fail "$path → $want but missing \"$text\""; fails=$((fails + 1)); return; fi
    c_ok "$want $path ${got#* }${text:+ ✓ \"$text\"}"
}
check / 200 "Production Efficiency Metrics"
check /about/ 200 "Precision Laser Engraving in the Heart of Montreal"
check /request-a-quote/ 200 'data-xp-form="quote"'
check /co2-laser-specifications/ 200 "xTool P3 80W CO2 Laser Technology"
check /industrial-signage/ 200 "Industrial Identification"
check /private-events/ 200 "Private Galas"
check /corporate-branding/ 200 "Corporate Identity,"
check /industrial-labels/ 200 "Tough"
check /commercial-signage/ 200 "Professional Signage That Builds Your Brand"
check /corporate-gifts/ 200 "Personalized Corporate Gifts"
check /hospitality/ 200 "Premium Hospitality Solutions"
check /events-weddings/ 200 "Bespoke Event Solutions"
check /solutions/ 200 "Our Laser Engraving Solutions for Every Sector"
check /services/ 200 "Our Laser Engraving Services for Every Sector"
check /portfolio/ 200 "Our Latest Work"
check /projects/ 200 "Industrial Panel Tags"
check /projects/industrial-panel-tags/ 200 "HYDRO-QUEBEC"
check /sitemap.xml 200
check /robots.txt 200
check /home/ 301
check /scenario/maximum-bed-size/ 301
check /industrial_id/industrial-safety-tag-solutions/ 301
check /CorporateBrandingPage 301
check /stat-precision/ 404

counts=$(api GET '/posts/?limit=1&fields=id' | jq -r '.meta.pagination.total')
pcounts=$(api GET '/pages/?limit=1&fields=id' | jq -r '.meta.pagination.total')
version=$(api GET /site/ | jq -r '.site.version')
echo
echo "  Ghost $version · theme xpektrum-laser · posts: $counts (4 projects + 3 stats + 5 workflow steps) · pages: $pcounts"
echo "  Admin: $GHOST_URL/ghost/  ($GHOST_ADMIN_EMAIL)"
rm -f "$BODY"
[ "$fails" -eq 0 ] && c_ok "all checks passed" || { c_fail "$fails check(s) failed"; exit 1; }
