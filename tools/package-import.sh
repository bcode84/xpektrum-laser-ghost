#!/usr/bin/env bash
# Package the Ghost import: images.zip (content/images/...) and ghost-import.zip (JSON + images).
# Usage: tools/package-import.sh [repoRoot]
set -euo pipefail
ROOT="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
OUT="$ROOT/content-export"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/content/images"
cp -R "$OUT/images/optimized/." "$STAGE/content/images/"
rm -f "$OUT/images.zip" "$OUT/ghost-import.zip"
(cd "$STAGE" && zip -qr "$OUT/images.zip" content)
cp "$OUT/ghost-import.json" "$STAGE/ghost-import.json"
(cd "$STAGE" && zip -qr "$OUT/ghost-import.zip" ghost-import.json content)
ls -lh "$OUT/images.zip" "$OUT/ghost-import.zip" | awk '{print $5, $9}'
