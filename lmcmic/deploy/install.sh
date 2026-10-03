#!/usr/bin/env bash
# Install or update lmcmic.ca on the Lendmax server from a release tarball.
#   sudo bash install.sh /tmp/lmcmic-release.tar.gz
# The tarball holds dist/, server/lead-server.mjs and deploy/. Each run makes a
# new timestamped release and flips /var/www/lmcmic.ca/current atomically, so
# a bad release is undone with:  ln -sfn <previous release> /var/www/lmcmic.ca/current
set -euo pipefail

TARBALL=${1:?usage: install.sh release.tar.gz}
STAMP=$(date +%Y%m%d-%H%M%S)
WWW=/var/www/lmcmic.ca
REL=$WWW/releases/$STAMP
WORK=$(mktemp -d)

tar -xzf "$TARBALL" -C "$WORK"

# ---- static site
mkdir -p "$REL"
cp -a "$WORK/dist/." "$REL/"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +
ln -sfn "$REL" "$WWW/current.new" && mv -Tf "$WWW/current.new" "$WWW/current"
ls -1dt "$WWW"/releases/* | tail -n +6 | xargs -r rm -rf     # keep five releases

# ---- lead endpoint
id lmcmic >/dev/null 2>&1 || useradd --system --home /var/lib/lmcmic --shell /usr/sbin/nologin lmcmic
install -d -o lmcmic -g lmcmic -m 700 /var/lib/lmcmic
install -d -m 755 /opt/lmcmic /etc/lmcmic
install -m 644 "$WORK/server/lead-server.mjs" /opt/lmcmic/lead-server.mjs
# The service user cannot read node's install under /root, so it gets its own
# copy of the (self-contained) binary.
NODE_BIN=$(readlink -f "$(command -v node)")
install -d -m 755 /opt/lmcmic/bin
cmp -s "$NODE_BIN" /opt/lmcmic/bin/node || install -m 755 "$NODE_BIN" /opt/lmcmic/bin/node
[ -f /etc/lmcmic/leads.env ] || install -m 640 -g lmcmic "$WORK/deploy/leads.env.example" /etc/lmcmic/leads.env
touch /var/log/lmcmic-leads.log && chown lmcmic:lmcmic /var/log/lmcmic-leads.log
install -m 644 "$WORK/deploy/lmcmic-leads.service" /etc/systemd/system/lmcmic-leads.service
systemctl daemon-reload
systemctl enable lmcmic-leads >/dev/null 2>&1
systemctl restart lmcmic-leads

# ---- nginx: always install the current vhost; once the Let's Encrypt
# certificate exists, point the vhost at it and keep HSTS on.
CONF=/etc/nginx/sites-available/lmcmic.ca
LIVE=/etc/letsencrypt/live/lmcmic.ca
[ -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] || make-ssl-cert generate-default-snakeoil --force-overwrite
[ -f "$CONF" ] && cp "$CONF" "$CONF.bak-$STAMP"
install -m 644 "$WORK/deploy/nginx-lmcmic.ca.conf" "$CONF"
if [ -f "$LIVE/fullchain.pem" ]; then
  sed -i \
    -e "s#/etc/ssl/certs/ssl-cert-snakeoil.pem;\( *\)\# LMCMIC_CERT#$LIVE/fullchain.pem;\1\# LMCMIC_CERT#" \
    -e "s#/etc/ssl/private/ssl-cert-snakeoil.key;\( *\)\# LMCMIC_KEY#$LIVE/privkey.pem;\1\# LMCMIC_KEY#" \
    -e "s|# add_header Strict-Transport-Security|add_header Strict-Transport-Security|" "$CONF"
fi
ln -sfn "$CONF" /etc/nginx/sites-enabled/lmcmic.ca
mkdir -p /var/www/certbot
if ! nginx -t; then
  echo "nginx -t failed; restoring the previous lmcmic.ca vhost" >&2
  [ -f "$CONF.bak-$STAMP" ] && cp "$CONF.bak-$STAMP" "$CONF"
  nginx -t && systemctl reload nginx
  exit 1
fi
systemctl reload nginx
ls -1t "$CONF".bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f

# ---- certificate watcher
install -m 755 "$WORK/deploy/lmcmic-cert.sh" /usr/local/sbin/lmcmic-cert
echo "*/5 * * * * root /usr/local/sbin/lmcmic-cert" > /etc/cron.d/lmcmic-cert
/usr/local/sbin/lmcmic-cert || true

rm -rf "$WORK"
echo "lmcmic.ca release $STAMP installed"
