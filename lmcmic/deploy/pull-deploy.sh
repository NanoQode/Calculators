#!/usr/bin/env bash
# Deploy lmcmic.ca on the server straight from GitHub.
#   sudo bash pull-deploy.sh [branch]        (default: ccr-ecad3a6a-7fqler)
# Downloads the branch archive, takes lmcmic/{dist,server,deploy} and runs
# deploy/install.sh with them. Nothing is built on the server.
set -euo pipefail
BRANCH=${1:-ccr-ecad3a6a-7fqler}
REPO=${LMCMIC_REPO:-nanoqode/calculators}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$WORK/src.tgz"
tar -xzf "$WORK/src.tgz" -C "$WORK"
SRC=$(find "$WORK" -maxdepth 2 -type d -name lmcmic | head -1)
[ -d "$SRC/dist" ] || { echo "no lmcmic/dist in $REPO@$BRANCH" >&2; exit 1; }
tar -czf "$WORK/release.tgz" -C "$SRC" dist server/lead-server.mjs deploy
bash "$SRC/deploy/install.sh" "$WORK/release.tgz"
