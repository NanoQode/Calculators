# Deploying instasure.ca

Everything needed to run instasure.ca on a server lives in this folder:

| File | Installed as | What it does |
|---|---|---|
| `deploy.sh` | `/usr/local/sbin/instasure-deploy` | Builds a release from git, checks it, switches to it, verifies it and rolls back on failure |
| `instasure.service` | `/etc/systemd/system/instasure.service` | Runs the Node app as user `instasure` on 127.0.0.1:3330 |
| `nginx-instasure.ca.conf` | `/etc/nginx/sites-available/instasure.ca` | HTTPS, `www` and `http` redirects, proxy to the app |
| `instasure-content-sync.sh` | `/usr/local/sbin/instasure-content-sync` | Publishes new guide files from git every 15 minutes (see `docs/BLOG_PUBLISHING.md`) |
| `instasure-content-sync.cron` | `/etc/cron.d/instasure-content-sync` | Schedule for the content sync |

Code deploys and content publishing are separate. Guides go live through the content sync (database), so deploying code never publishes or changes a guide.

## Server layout

| Path | Contents |
|---|---|
| `/srv/instasure/releases/<commit>/` | One directory per release (`instasure.ca/` folder of the repo at that commit, plus `node_modules`) |
| `/srv/instasure/current` | Symlink to the live release; the systemd unit runs from here |
| `/srv/instasure/backups/` | Deploy backups (server-side edits overwritten with `--accept-drift`) |
| `/var/lib/instasure/` | Database (`instasure.db`, SQLite WAL), uploads, content-sync files. Owned by `instasure`; never touched by a deploy |
| `/etc/instasure/instasure.env` | Settings and secrets (root only, `600`). Never commit or print it |
| `/opt/instasure/bin/node` | Node 22 binary used by the app |
| `/var/log/instasure.log`, `/var/log/instasure-deploy.log`, `/var/log/instasure-content.log` | App, deploy and content-sync logs |

## Routine deploy

```bash
# once: install or update the deploy command from the repo
git -C /tmp clone -q --depth 1 -b claude/instasure-competitive-analysis-pmf7wk https://github.com/NanoQode/Calculators instasure-src
install -m 755 /tmp/instasure-src/instasure.ca/deploy/deploy.sh /usr/local/sbin/instasure-deploy && rm -rf /tmp/instasure-src

instasure-deploy --status            # live release, its commit, any edits made on the server since
instasure-deploy --dry-run           # build and check the head of the branch without switching
instasure-deploy                     # deploy the head of the branch
instasure-deploy --ref 1a2b3c4       # deploy a specific commit
instasure-deploy --rollback          # switch back to the previous release
```

What `instasure-deploy` does, in order:

1. Fetches the commit from GitHub and extracts `instasure.ca/` into `/srv/instasure/releases/<short-commit>/`, recording the commit, build time and previous release.
2. **Server-side edit check.** Compares the live release with the commit it was deployed from. If code was edited on the server and not committed to git, it stops (exit 3) and lists the files, so a deploy never silently wipes a hand edit. Commit those files to git first, or rerun with `--accept-drift` to overwrite them (they are saved to `/srv/instasure/backups/deploy-<time>/` first).
3. Dependencies: reuses the live `node_modules` when `package-lock.json` is unchanged, otherwise runs `npm ci --omit=dev`.
4. Preflight: `node --check` on every script, compiles every EJS template, loads the data modules, and checks that the built stylesheet `public/assets/site.css` is present (run `npm run build:css` and commit it after template class changes).
5. Carries the **server-managed assets** forward from the live release (below).
6. Switches the `current` symlink atomically and restarts the service.
7. Health check: `/`, the sitemaps, `robots.txt`, `llms.txt`, `/guides/`, `/quote/`, a product page, a service page and one photo must return 200.
8. Crawls every URL in every sitemap; all must return 200 (`--no-crawl` skips this).
9. On any failure after the switch: switches back to the previous release, restarts and re-checks (exit 1).
10. Keeps the 5 newest releases it built (`--keep N`), plus the live and previous ones. Releases made by hand are never pruned.

Before every deploy, run `npm test` locally (it must pass) and push to the branch.

## Server-managed assets

Editorial photos are generated and placed on the server, not stored in git:

- `public/img/photos/` (about 1,400 files, 136 MB as of October 13, 2026: one JPEG master plus WebP sizes per image)
- `src/data/editorial-photos.json` (which photo appears in which slot on which page)

Each deploy copies both from the live release into the new one (hard links, so no extra disk space), again right before the switch, and once more right after it, so photos added while a deploy runs are kept. A rollback also brings newer photos along. To change this list, edit `CARRY` at the top of `deploy.sh`.

## First-time server setup

On a fresh Ubuntu server, as root:

```bash
# 1. User, directories, Node
useradd --system --home /var/lib/instasure --shell /usr/sbin/nologin instasure
install -d -o instasure -g instasure -m 750 /var/lib/instasure /var/lib/instasure/uploads
install -d -m 755 /srv/instasure/releases /srv/instasure/backups /opt/instasure/bin
# put a Node 22.5+ binary at /opt/instasure/bin/node (the app needs node:sqlite); npm for dependency installs

# 2. Settings: copy .env.example to /etc/instasure/instasure.env (chmod 600) and fill in at least
#    NODE_ENV=production  SITE_URL=https://instasure.ca  HOST=127.0.0.1  PORT=3330
#    SESSION_SECRET and TRACKING_SECRET (openssl rand -hex 32 each)  ADMIN_EMAIL  ADMIN_PASSWORD
#    DB_PATH=/var/lib/instasure/instasure.db  UPLOADS_DIR=/var/lib/instasure/uploads  TRUST_PROXY=1
#    INDEXNOW_ENABLED=true  DRIP_DISABLED  PAGE_CACHE_TTL_MS  and SMTP_* once mail is set up

# 3. First release (there is no live release to compare with yet)
C=$(git ls-remote https://github.com/NanoQode/Calculators refs/heads/claude/instasure-competitive-analysis-pmf7wk | cut -c1-40)
T=$(mktemp -d) && git -C "$T" init -q && git -C "$T" fetch -q --depth 1 https://github.com/NanoQode/Calculators "$C"
mkdir /srv/instasure/releases/${C:0:7} && git -C "$T" archive FETCH_HEAD instasure.ca | tar -x -C /srv/instasure/releases/${C:0:7} --strip-components=1
echo "$C" > /srv/instasure/releases/${C:0:7}/.release-commit
(cd /srv/instasure/releases/${C:0:7} && npm ci --omit=dev)
ln -sfn /srv/instasure/releases/${C:0:7} /srv/instasure/current

# 4. Service, web server, certificate
cp instasure.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now instasure
cp nginx-instasure.ca.conf /etc/nginx/sites-available/instasure.ca && ln -s ../sites-available/instasure.ca /etc/nginx/sites-enabled/
certbot certonly --webroot -w /var/www/certbot -d instasure.ca -d www.instasure.ca
nginx -t && systemctl reload nginx        # always nginx -t first: the reload affects every site on the server

# 5. Content sync and deploy command
install -m 755 instasure-content-sync.sh /usr/local/sbin/instasure-content-sync
install -m 644 instasure-content-sync.cron /etc/cron.d/instasure-content-sync
install -m 755 deploy.sh /usr/local/sbin/instasure-deploy
```

The first start creates the database and the admin account. `npm run seed` is idempotent.

## Database and scripts

A deploy never writes to the database. To run a script against production (for example `team-advisor`, `indexnow-submit`, `publish-guides --update`), run it as the database owner so the WAL files keep the right owner, then restart, because settings and pages are cached in memory:

```bash
cd /srv/instasure/current && set -a && . /etc/instasure/instasure.env && set +a
runuser -u instasure -- /opt/instasure/bin/node --disable-warning=ExperimentalWarning scripts/<name>.js
systemctl restart instasure
```

## State as of October 13, 2026: read before the first deploy with this script

- The live release is `/srv/instasure/releases/layout-20261005b`. It was **not** built from git: it is release `3fa6b49` plus two hand deploys on October 5 (editorial photos, then a layout update), plus later edits made directly on the server by an image process that writes `guardian-*` backups to `/var/lib/instasure/backups/` (it adds a photo for each new guide and edited `editorial-photos.js`, `home.ejs` and `guide-card.ejs` on October 12).
- Those code changes are **not in git**: `src/lib/editorial-photos.js` (new), `src/app.js`, `src/styles/site.css`, `public/assets/site.css` and 23 templates under `views/public/`. Until they are committed, a deploy from git would remove every editorial photo from the site. The deploy script detects this and stops (`instasure-deploy --dry-run` lists the files).
- To make git the source of truth: copy those files from the live release into the repo, review and commit them, run `npm test`, then `instasure-deploy --dry-run` (it should report no code differences other than intended ones), then `instasure-deploy --accept-drift` once to adopt the hand-made release. From then on every release records its commit and the edit check is exact.
- Whoever runs the image process should commit code changes to git rather than editing the live release, or the next deploy will stop and list them.
