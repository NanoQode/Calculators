#!/bin/bash
# instasure.ca content sync: publish new guides pushed to the content branch.
# Installed as /usr/local/sbin/instasure-content-sync; run by /etc/cron.d/instasure-content-sync every 15 minutes.
# Fetches instasure.ca/src/content/guides/*.md from the branch head and runs scripts/publish-guides.js from the
# live release, which publishes only slugs that are not in the database yet (never overwrites a live guide).
set -euo pipefail
REPO=https://github.com/NanoQode/Calculators
BRANCH=${INSTASURE_CONTENT_BRANCH:-claude/instasure-competitive-analysis-pmf7wk}
STATE=/var/lib/instasure/content-sync.sha
DEST=/var/lib/instasure/content/guides
LOG=/var/log/instasure-content.log
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

exec 9>/run/instasure-content-sync.lock
flock -n 9 || exit 0
HEAD=$(GIT_TERMINAL_PROMPT=0 timeout 60 git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
if [ -z "$HEAD" ]; then log "ERROR could not read $BRANCH"; exit 1; fi
if [ "${1:-}" != "--force" ] && [ "$HEAD" = "$(cat "$STATE" 2>/dev/null || true)" ]; then exit 0; fi

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cd "$T"; git init -q; GIT_TERMINAL_PROMPT=0 timeout 120 git fetch -q --depth 1 "$REPO" "$HEAD"
git archive FETCH_HEAD instasure.ca/src/content/guides | tar -x
install -d -o instasure -g instasure -m 750 /var/lib/instasure/content "$DEST"
cp instasure.ca/src/content/guides/*.md "$DEST"/
chown instasure:instasure "$DEST"/*.md

set -a; . /etc/instasure/instasure.env; set +a
cd /srv/instasure/current
if OUT=$(runuser -u instasure -- /opt/instasure/bin/node --disable-warning=ExperimentalWarning scripts/publish-guides.js --dir "$DEST" 2>&1); then
  log "${HEAD:0:7} $OUT"
  echo "$HEAD" > "$STATE"
  echo "$OUT"
else
  log "ERROR ${HEAD:0:7} $OUT"; echo "$OUT" >&2; exit 1
fi
