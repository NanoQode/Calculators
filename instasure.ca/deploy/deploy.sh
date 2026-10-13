#!/usr/bin/env bash
# instasure.ca release deploy: build a release from git, check it, switch to it, verify it, roll back on failure.
# Installed on the server as /usr/local/sbin/instasure-deploy (see deploy/DEPLOY.md). Run as root.
#
#   instasure-deploy                       deploy the head of the content branch
#   instasure-deploy --ref <commit|branch> deploy a specific commit or branch
#   instasure-deploy --dry-run             build and check a release without switching to it
#   instasure-deploy --rollback            switch back to the release that was live before the current one
#   instasure-deploy --status              show the live release, its commit and any server-side edits
#
# Options: --accept-drift (deploy over files edited on the server; they are backed up first),
#          --no-crawl (skip the full sitemap crawl), --keep N (releases to keep, default 5).
# Exit codes: 0 ok, 1 failed and rolled back, 2 usage or precondition, 3 blocked by server-side edits.
set -Eeuo pipefail
umask 022

REPO=${INSTASURE_REPO:-https://github.com/NanoQode/Calculators}
BRANCH=${INSTASURE_BRANCH:-claude/instasure-competitive-analysis-pmf7wk}
SUBDIR=${INSTASURE_SUBDIR:-instasure.ca}
BASE=${INSTASURE_BASE:-/srv/instasure}
RELEASES=$BASE/releases
CURRENT=$BASE/current
BACKUPS=$BASE/backups
SERVICE=${INSTASURE_SERVICE:-instasure}
NODE=${INSTASURE_NODE:-/opt/instasure/bin/node}
NPM_DIR=${INSTASURE_NPM_DIR:-/root/.hermes/node/bin}   # directory holding npm (only used when dependencies change)
APP_URL=${INSTASURE_APP_URL:-http://127.0.0.1:3330}
SITE_HOST=${INSTASURE_HOST:-instasure.ca}
LOG=${INSTASURE_DEPLOY_LOG:-/var/log/instasure-deploy.log}
# Server-managed assets: written on the server (editorial photos and their page map), not stored in git.
# Each deploy carries them forward from the live release.
CARRY=(public/img/photos src/data/editorial-photos.json)
# Paths that never count as server-side code edits (content, docs and deploy records).
DRIFT_IGNORE=(node_modules data docs deploy src/content/guides CLAUDE.md README.md .release-commit .release-built .previous-release)

REF=$BRANCH; DRY=0; ACCEPT_DRIFT=0; CRAWL=1; KEEP=5; MODE=deploy; ROLLBACK_TO=
usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF=${2:?--ref needs a value}; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --accept-drift) ACCEPT_DRIFT=1; shift ;;
    --no-crawl) CRAWL=0; shift ;;
    --keep) KEEP=${2:?--keep needs a number}; shift 2 ;;
    --rollback) MODE=rollback; shift ;;
    --to) ROLLBACK_TO=${2:?--to needs a release directory}; shift 2 ;;
    --status) MODE=status; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2; }
die() { log "ERROR $1"; exit "${2:-2}"; }
[ "$(id -u)" -eq 0 ] || die "run as root"
[ -x "$NODE" ] || die "node not found at $NODE"
exec 9>/run/instasure-deploy.lock
flock -n 9 || die "another deploy is running"

TMP=$(mktemp -d); NEW=
cleanup() { rm -rf "$TMP"; if [ "$DRY" -eq 1 ] && [ -n "$NEW" ]; then rm -rf "$NEW"; fi; }
trap cleanup EXIT

PREV=$(readlink -f "$CURRENT" || true)
[ -n "$PREV" ] && [ -d "$PREV" ] || die "$CURRENT does not point at a release"

http() { # http PATH -> status code from the local app, as the public site would see it
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Host: $SITE_HOST" -H 'X-Forwarded-Proto: https' "$APP_URL$1" || echo 000
}

fetch_commit() { # fetch_commit REF DIR -> archives $SUBDIR of REF into DIR, prints the full commit id
  local ref=$1 dir=$2 g="$TMP/git-$RANDOM"
  git init -q "$g"
  GIT_TERMINAL_PROMPT=0 timeout 180 git -C "$g" fetch -q --depth 1 "$REPO" "$ref" || return 1
  mkdir -p "$dir"
  git -C "$g" archive FETCH_HEAD "$SUBDIR" | tar -x -C "$dir" --strip-components=1
  git -C "$g" rev-parse FETCH_HEAD
}

drift_list() { # drift_list LIVE REFERENCE -> code files that differ, one per line
  local args=() p
  for p in "${DRIFT_IGNORE[@]}" "${CARRY[@]##*/}"; do args+=(--exclude="$p"); done
  diff -rq "${args[@]}" "$2" "$1" 2>/dev/null \
    | sed -E "s#^Files $2/(.*) and .* differ#changed  \1#; s#^Only in $1/?(.*): (.*)#server-only  \1/\2#; s#^Only in $2/?(.*): (.*)#git-only  \1/\2#; s#  /#  #" || true
}

health() { # health -> 0 when the app answers and key pages return 200
  local code p
  for _ in $(seq 1 40); do code=$(http /); [ "$code" = 200 ] && break; sleep 1; done
  [ "$code" = 200 ] || { log "health: / returned $code"; return 1; }
  systemctl is-active --quiet "$SERVICE" || { log "health: service not active"; return 1; }
  for p in /sitemap.xml /sitemap-guides.xml /robots.txt /llms.txt /guides/ /quote/ /car-insurance/ /life-insurance/funeral-expense/; do
    code=$(http "$p"); [ "$code" = 200 ] || { log "health: $p returned $code"; return 1; }
  done
  local photo; photo=$(find "$(readlink -f "$CURRENT")/public/img/photos" -maxdepth 1 -name '*.jpeg' -print -quit 2>/dev/null || true)
  if [ -n "$photo" ]; then code=$(http "/img/photos/${photo##*/}"); [ "$code" = 200 ] || { log "health: photo returned $code"; return 1; }; fi
  return 0
}

crawl() { # crawl -> 0 when every URL in every sitemap returns 200
  local urls="$TMP/urls" bad="$TMP/bad" sm
  : > "$urls"
  for sm in $(curl -s --max-time 20 -H "Host: $SITE_HOST" -H 'X-Forwarded-Proto: https' "$APP_URL/sitemap.xml" | grep -o '<loc>[^<]*' | sed 's#<loc>https\?://[^/]*##'); do
    curl -s --max-time 20 -H "Host: $SITE_HOST" -H 'X-Forwarded-Proto: https' "$APP_URL$sm" | grep -o '<loc>[^<]*' | sed 's#<loc>https\?://[^/]*##' >> "$urls"
  done
  local n; n=$(wc -l < "$urls")
  [ "$n" -gt 0 ] || { log "crawl: no URLs found in the sitemaps"; return 1; }
  export APP_URL SITE_HOST
  xargs -P 8 -I{} sh -c 'c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -H "Host: $SITE_HOST" -H "X-Forwarded-Proto: https" "$APP_URL{}"); [ "$c" = 200 ] || echo "$c {}"' < "$urls" > "$bad"
  if [ -s "$bad" ]; then log "crawl: $(wc -l < "$bad") of $n URLs failed:"; head -20 "$bad" >&2; return 1; fi
  log "crawl: $n/$n sitemap URLs returned 200"
}

switch_to() { # switch_to DIR -> atomically repoint current and restart the app
  ln -sfn "$1" "$BASE/.current-next" && mv -T "$BASE/.current-next" "$CURRENT"
  systemctl restart "$SERVICE" 9>&-   # do not pass the deploy lock to the service
}

carry_forward() { # carry_forward FROM TO -> copy server-managed assets (hard links for files that are unchanged)
  local p
  for p in "${CARRY[@]}"; do
    [ -e "$1/$p" ] || continue
    rm -rf "${2:?}/$p"; mkdir -p "$(dirname "$2/$p")"
    if [ -d "$1/$p" ]; then cp -al "$1/$p" "$2/$p" 2>/dev/null || cp -a "$1/$p" "$2/$p"; else cp -a "$1/$p" "$2/$p"; fi
  done
}

catch_up() { # catch_up FROM TO -> add server-managed assets written to FROM that TO doesn't have yet
  local p
  for p in "${CARRY[@]}"; do
    if [ -d "$1/$p" ]; then mkdir -p "$2/$p"; cp -a --update=none "$1/$p/." "$2/$p/" 2>/dev/null || cp -a -n "$1/$p/." "$2/$p/"
    elif [ -f "$1/$p" ] && { [ ! -e "$2/$p" ] || [ "$1/$p" -nt "$2/$p" ]; }; then cp -a "$1/$p" "$2/$p"; fi
  done
}

# ---------------------------------------------------------------- status
if [ "$MODE" = status ]; then
  echo "live release: $PREV"
  if [ -f "$PREV/.release-commit" ]; then
    c=$(cat "$PREV/.release-commit"); echo "built from:   $c ($(cat "$PREV/.release-built" 2>/dev/null || echo '?'))"
    fetch_commit "$c" "$TMP/ref" >/dev/null || die "could not fetch $c"
    d=$(drift_list "$PREV" "$TMP/ref")
    if [ -z "$d" ]; then echo "server-side edits: none"; else echo "server-side edits since deploy:"; echo "$d"; fi
  else
    echo "built from:   not recorded (this release was not deployed with this script)"
  fi
  echo "previous:     $(cat "$PREV/.previous-release" 2>/dev/null || echo 'not recorded')"
  echo "health:       $(health && echo ok || echo FAILED)"
  exit 0
fi

# ---------------------------------------------------------------- rollback
if [ "$MODE" = rollback ]; then
  target=${ROLLBACK_TO:-$(cat "$PREV/.previous-release" 2>/dev/null || true)}
  [ -n "$target" ] && [ -d "$target" ] || die "no previous release recorded; pass --to $RELEASES/<release>"
  log "rollback: $PREV -> $target"
  catch_up "$PREV" "$target"   # keep photos added since the target release was live
  switch_to "$target"
  health || die "rolled back to $target but the health check failed; check $LOG and journalctl -u $SERVICE" 1
  log "rollback complete: live release is $target"
  exit 0
fi

# ---------------------------------------------------------------- deploy
log "deploy: ref $REF (dry run: $DRY), live release $PREV"
STAGE="$TMP/stage"
COMMIT=$(fetch_commit "$REF" "$STAGE") || die "could not fetch $REF from $REPO"
SHORT=${COMMIT:0:7}
if [ "$DRY" -eq 0 ] && [ "$PREV" = "$RELEASES/$SHORT" ]; then
  log "deploy: $SHORT is already live"
  if health; then exit 0; fi
  die "health check failed on the live release" 1
fi
if [ "$DRY" -eq 1 ]; then NEW=$(mktemp -d "$BASE/.dry-run-$SHORT-XXXX"); else NEW=$RELEASES/$SHORT; fi
if [ "$DRY" -eq 0 ] && [ -e "$NEW" ]; then mv "$NEW" "$NEW.stale-$(date -u +%Y%m%dT%H%M%SZ)"; fi
mkdir -p "$NEW"; cp -a "$STAGE/." "$NEW/"
echo "$COMMIT" > "$NEW/.release-commit"; date -u +%FT%TZ > "$NEW/.release-built"; echo "$PREV" > "$NEW/.previous-release"

# 1. Server-side edits: never overwrite code that was changed on the server and not committed to git.
if [ -f "$PREV/.release-commit" ]; then
  base_commit=$(cat "$PREV/.release-commit")
  fetch_commit "$base_commit" "$TMP/base" >/dev/null || die "could not fetch $base_commit to check for server-side edits"
  DRIFT=$(drift_list "$PREV" "$TMP/base"); DRIFT_WHAT="edited on the server since $base_commit was deployed"
else
  DRIFT=$(drift_list "$PREV" "$NEW"); DRIFT_WHAT="different from $SHORT (the live release has no git record, so server-side edits and new commits can't be told apart)"
fi
if [ -n "$DRIFT" ]; then
  log "drift: $(printf '%s\n' "$DRIFT" | wc -l) live files are $DRIFT_WHAT:"
  printf '%s\n' "$DRIFT" >&2
  if [ "$ACCEPT_DRIFT" -eq 1 ] && [ "$DRY" -eq 0 ]; then
    b="$BACKUPS/deploy-$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -p "$b"
    printf '%s\n' "$DRIFT" | awk '$1!="git-only"{print $2}' | (cd "$PREV" && tar -czf "$b/server-edits.tar.gz" -T - 2>/dev/null || true)
    printf '%s\n' "$DRIFT" > "$b/server-edits.txt"; log "drift: accepted; server copies saved to $b"
  elif [ "$DRY" -eq 1 ]; then
    log "drift: a real deploy would stop here; commit the server copies to git first, or use --accept-drift"
  else
    rm -rf "$NEW"; die "blocked: commit these server-side edits to git first, or rerun with --accept-drift to overwrite them (they are backed up)" 3
  fi
fi

# 2. Dependencies: reuse the live node_modules when the lockfile is unchanged.
if cmp -s "$NEW/package-lock.json" "$PREV/package-lock.json" && [ -d "$PREV/node_modules" ]; then
  cp -a "$PREV/node_modules" "$NEW/node_modules"; log "deps: lockfile unchanged, reused node_modules"
else
  log "deps: lockfile changed, running npm ci --omit=dev"
  (cd "$NEW" && PATH="$NPM_DIR:$PATH" npm ci --omit=dev --no-audit --no-fund --loglevel=error) || die "npm ci failed"
fi

# 3. Preflight: syntax, templates, data modules and the built stylesheet.
[ -s "$NEW/public/assets/site.css" ] || die "public/assets/site.css is missing (run npm run build:css and commit it)"
(cd "$NEW" && find server.js src scripts -name '*.js' -print0 | xargs -0 -n1 "$NODE" --check) || die "JavaScript syntax check failed"
carry_forward "$PREV" "$NEW"
(cd "$NEW" && "$NODE" --disable-warning=ExperimentalWarning -e '
  const fs = require("fs"), path = require("path"), ejs = require("ejs");
  let n = 0;
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ejs")) { ejs.compile(fs.readFileSync(p, "utf8"), { filename: p }); n++; } } })("views");
  for (const m of ["./src/data/geo", "./src/data/products", "./src/data/services", "./src/data/keywords", "./src/data/providers", "./src/lib/quote-engine"]) require(m);
  if (fs.existsSync("src/lib/editorial-photos.js")) require("./src/lib/editorial-photos");
  console.error("preflight: " + n + " templates compiled, data modules load");
') || die "preflight failed (templates or data modules)"
log "preflight: ok for $SHORT"

if [ "$DRY" -eq 1 ]; then
  log "dry run complete for $SHORT: the release builds and passes preflight${DRIFT:+, but the drift above would block a real deploy}"
  exit 0
fi

# 4. Switch, verify, and roll back automatically on any failure.
rollback_now() {
  trap - ERR
  log "deploy failed; rolling back to $PREV"
  catch_up "$NEW" "$PREV"
  switch_to "$PREV"
  if health; then log "rolled back: $PREV is live again"; else log "ROLLBACK HEALTH CHECK FAILED: check journalctl -u $SERVICE"; fi
  exit 1
}
catch_up "$PREV" "$NEW"        # again, right before the switch, to pick up assets written during the build
switch_to "$NEW"
trap rollback_now ERR
health || rollback_now
catch_up "$PREV" "$NEW"        # anything written to the old release in the seconds around the switch
if [ "$CRAWL" -eq 1 ]; then crawl || rollback_now; fi
trap - ERR
log "deploy complete: $SHORT ($COMMIT) is live; previous release $PREV"

# 5. Prune: keep the newest $KEEP releases this script built, plus the live and previous ones.
mapfile -t built < <(for d in "$RELEASES"/*/; do d=${d%/}; [ -f "$d/.release-commit" ] && echo "$(stat -c %Y "$d") $d"; done | sort -rn | awk '{print $2}')
for d in "${built[@]:$KEEP}"; do
  [ "$d" = "$NEW" ] || [ "$d" = "$PREV" ] || { rm -rf "$d"; log "prune: removed $d"; }
done
exit 0
