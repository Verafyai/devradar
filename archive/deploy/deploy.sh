#!/usr/bin/env bash
# Deploy a DevRadar site archive (static pages + api/ functions + package.json; Vercel installs deps and builds functions remotely) to Vercel production (project devradar, scope verafyai).
# BLOB_READ_WRITE_TOKEN comes from the connected Blob store agentready-blob (shared with project agentready so old reports stay readable; Production+Preview); nothing secret lives in the archive.
# Usage: ./deploy.sh /path/to/site.tgz   (archive must contain top-level site/)
# Needs VERCEL_TOKEN in the environment (never printed).
set -euo pipefail
TGZ="${1:?usage: deploy.sh <site.tgz>}"
[ -f "$TGZ" ] || { echo "no such archive: $TGZ" >&2; exit 1; }
[ -n "${VERCEL_TOKEN:-}" ] || { echo "VERCEL_TOKEN is not set" >&2; exit 1; }
SCOPE=verafyai; PROJECT=devradar; DOMAIN=devradar.rexstjohn.com
VERCEL=$(command -v vercel || echo "npx --yes vercel@latest")
DIR=/workspace/devradar-deploy/deploy
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
tar xzf "$TGZ" -C "$TMP"
[ -f "$TMP/site/index.html" ] || { echo "archive has no site/index.html" >&2; exit 1; }
# keep project link, replace site contents
mkdir -p "$DIR/site"; [ -d "$DIR/site/.vercel" ] && cp -r "$DIR/site/.vercel" "$TMP/site/"
rm -rf "$DIR/site"; mv "$TMP/site" "$DIR/site"; cd "$DIR/site"
[ -d .vercel ] || $VERCEL link --yes --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" >/dev/null 2>&1
rm -rf .env .env.* node_modules
OUT=$($VERCEL deploy --prod --yes --scope "$SCOPE" --token "$VERCEL_TOKEN" 2>&1) || { echo "$OUT" | grep -v -i token | tail -20 >&2; exit 1; }
echo "$OUT" | grep -Eo "https://[a-z0-9.-]+\.vercel\.app" | tail -2
$VERCEL domains add "$DOMAIN" "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
sleep 3
for p in / /robots.txt /favicon.ico $(cd r 2>/dev/null && ls -d */ 2>/dev/null | sed 's#^#/r/#'); do
  h=$(curl -sI --retry 3 --retry-all-errors --doh-url https://dns.google/dns-query "https://$DOMAIN$p" || true)
  echo "$p -> $(echo "$h" | head -1 | tr -d '\r') $(echo "$h" | grep -i '^x-robots-tag' | tr -d '\r')"
done
