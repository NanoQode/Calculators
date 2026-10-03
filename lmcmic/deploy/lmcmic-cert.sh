#!/usr/bin/env bash
# Issue the Let's Encrypt certificate for lmcmic.ca as soon as the domain
# reaches this server, then switch nginx from the placeholder certificate and
# turn on HSTS. Safe to run repeatedly (cron, every 5 minutes); does nothing
# once the certificate is in place. Works whether Cloudflare proxies the
# record or not, because it tests real HTTP reachability, not the DNS answer.
set -euo pipefail

CONF=/etc/nginx/sites-available/lmcmic.ca
LIVE=/etc/letsencrypt/live/lmcmic.ca
WEBROOT=/var/www/certbot
LOG=/var/log/lmcmic-cert.log
EMAIL=${LMCMIC_CERT_EMAIL:-deals@lendmaxcapital.ca}

log() { echo "$(date -Is) $*" >> "$LOG"; }

has_www() { [ -f "$LIVE/cert.pem" ] && openssl x509 -in "$LIVE/cert.pem" -noout -text | grep -q "DNS:www.lmcmic.ca"; }

# Probe through public DNS (as Let's Encrypt will), not this host's resolver
# cache, which can keep the previous address for the length of the old TTL.
probe() {  # probe <host> <token> → prints the body served for the token
  local host=$1 ip
  ip=$(dig +short "$host" @1.1.1.1 | grep -E '^[0-9.]+$' | tail -1)
  [ -n "$ip" ] || return 0
  curl -s -m 10 --resolve "$host:80:$ip" "http://$host/.well-known/acme-challenge/$2" || true
}

mkdir -p "$WEBROOT/.well-known/acme-challenge"
token="probe-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
echo "$token" > "$WEBROOT/.well-known/acme-challenge/$token"
reach_apex=$(probe lmcmic.ca "$token")
reach_www=$(probe www.lmcmic.ca "$token")
rm -f "$WEBROOT/.well-known/acme-challenge/$token"

# Already live: nothing to do, unless www has since been pointed here and the
# certificate does not cover it yet.
if [ -f "$LIVE/fullchain.pem" ] && grep -q "$LIVE/fullchain.pem" "$CONF"; then
  if [ "$reach_www" = "$token" ] && ! has_www; then
    log "www.lmcmic.ca now reaches this server; expanding certificate"
    certbot certonly --webroot -w "$WEBROOT" -d lmcmic.ca -d www.lmcmic.ca --cert-name lmcmic.ca \
      --expand --non-interactive --agree-tos -m "$EMAIL" >> "$LOG" 2>&1 && systemctl reload nginx && log "certificate expanded to www"
  fi
  exit 0
fi

if [ "$reach_apex" != "$token" ]; then
  exit 0   # DNS still points elsewhere — try again next run
fi

domains=(-d lmcmic.ca)
[ "$reach_www" = "$token" ] && domains+=(-d www.lmcmic.ca)

log "lmcmic.ca reaches this server; requesting certificate for ${domains[*]}"
if certbot certonly --webroot -w "$WEBROOT" "${domains[@]}" --cert-name lmcmic.ca \
     --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring >> "$LOG" 2>&1; then
  cp "$CONF" "$CONF.bak-$(date +%Y%m%d%H%M%S)"
  sed -i \
    -e "s#/etc/ssl/certs/ssl-cert-snakeoil.pem;\( *\)\# LMCMIC_CERT#$LIVE/fullchain.pem;\1\# LMCMIC_CERT#" \
    -e "s#/etc/ssl/private/ssl-cert-snakeoil.key;\( *\)\# LMCMIC_KEY#$LIVE/privkey.pem;\1\# LMCMIC_KEY#" \
    -e "s|# add_header Strict-Transport-Security|add_header Strict-Transport-Security|" \
    "$CONF"
  if nginx -t >> "$LOG" 2>&1; then
    systemctl reload nginx
    log "certificate installed and nginx reloaded"
  else
    log "nginx -t failed after switching certificate; restoring previous config"
    cp "$(ls -t "$CONF".bak-* | head -1)" "$CONF"
    systemctl reload nginx
  fi
else
  log "certbot failed (see above); will retry"
fi
