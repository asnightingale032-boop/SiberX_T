#!/bin/bash
# Regenerate Subresource Integrity hashes for every CSS/JS asset and print
# the <link>/<script> tags with updated integrity="" values.
#
# SRI on same-origin assets (Security Recommendation, Dimension 11):
# closes the "compromised or swapped asset" path even though everything
# here is same-origin — if an edge cache, CDN layer, or build pipeline
# ever served a tampered file, the browser refuses to execute/apply it.
#
# Trade-off, stated plainly: because this is a static site with no build
# step, these hashes are NOT regenerated automatically. Run this script
# and update the affected HTML file(s) by hand any time you change
# assets/css/style.css or any file in assets/js/. A stale hash does not
# create a vulnerability — it fails safe (the browser blocks the asset
# and the page breaks obviously) — but it does mean a deploy will look
# broken until the HTML is updated to match.
#
# Usage: bash scripts/generate-sri.sh
set -e
cd "$(dirname "$0")/.."
for f in assets/css/style.css assets/js/*.js; do
  hash=$(openssl dgst -sha384 -binary "$f" | openssl base64 -A)
  echo "$f"
  echo "  integrity=\"sha384-$hash\""
done
