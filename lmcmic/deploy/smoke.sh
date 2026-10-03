#!/usr/bin/env bash
# Request every URL in the live sitemap through the local nginx and report any
# that is not a 200. Run after each deploy: bash smoke.sh
set -uo pipefail
R=(--resolve lmcmic.ca:443:127.0.0.1 -k -s -o /dev/null -w '%{http_code}')
fail=0; n=0
for u in $(curl -ks --resolve lmcmic.ca:443:127.0.0.1 https://lmcmic.ca/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//'); do
  n=$((n+1)); code=$(curl "${R[@]}" "$u")
  [ "$code" = 200 ] || { echo "FAIL $code $u"; fail=$((fail+1)); }
done
for u in /robots.txt /llms.txt /sitemap.xml /favicon.ico /assets/site.css /api/health; do
  code=$(curl "${R[@]}" "https://lmcmic.ca$u"); [ "$code" = 200 ] || { echo "FAIL $code $u"; fail=$((fail+1)); }
done
# every optimised image a page references
for u in $(grep -rhoE '/assets/img/[A-Za-z0-9@._-]+' /var/www/lmcmic.ca/current --include=index.html | sort -u); do
  n=$((n+1)); code=$(curl "${R[@]}" "https://lmcmic.ca$u")
  [ "$code" = 200 ] || { echo "FAIL $code $u"; fail=$((fail+1)); }
done
echo "smoke: $n URLs checked, $fail failures"
exit $fail
