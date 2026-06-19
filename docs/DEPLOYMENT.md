# Deployment — hatpro.archon.technology

Path-based single-domain hosting: three static apps + three reverse-proxied backend
services, kept alive by systemd. Assumes the repo at `/opt/hatpro-archon` and the
`archon-trust-registry` repo at `/opt/archon-trust-registry` (adjust paths if different).

## URL map
| Public path | Serves |
|---|---|
| `/` | welcome page (`/var/www/hatpro/index.html`, from `deploy/welcome/`) |
| `/traveler/` | traveler-wallet (dist) |
| `/supplier/` | supplier-console (dist) |
| `/registry/` | registry-explorer (dist) |
| `/resort-api/*` → `127.0.0.1:4326` | resort keymaster API |
| `/issuer-api/*` → `127.0.0.1:4327` | issuer API |
| `/trust-registry/*` → `127.0.0.1:4260` | TRQP trust registry |

The welcome page links to the three apps. Deploy it with:
```bash
sudo cp deploy/welcome/index.html /var/www/hatpro/index.html
```

The in-browser traveler wallet talks to the **public gatekeeper** `https://archon.technology`
directly (set in `apps/traveler-wallet/.env.production`). Backend services talk to the node
over `localhost:4222` (fast, bypasses the public proxy) via the repo `.env`.

## 1. Provision (once, and after any reset)
```bash
cd /opt/hatpro-archon
# .env → ARCHON_GATEKEEPER_URL=http://localhost:4222  (the server's own drawbridge)
npm install
npm run reset                                   # writes config/demo.json
node scripts/sync-trust-registry-env.mjs /opt/archon-trust-registry
```

## 2. Build the apps
```bash
bash deploy/build-apps.sh                        # → apps/*/dist (loads .env.production + demo.json)
```
> Re-run this after every `npm run reset` — the bundle embeds `demo.json`.

## 3. Build the trust registry
```bash
cd /opt/archon-trust-registry && npm install && npm run build   # → build/index.js
```

## 4. Backend services (systemd)
```bash
sudo cp /opt/hatpro-archon/deploy/systemd/hatpro-*.service /etc/systemd/system/
# adjust User=, WorkingDirectory=, and the node path if you use nvm
sudo systemctl daemon-reload
sudo systemctl enable --now hatpro-resort-api hatpro-issuer-api hatpro-trust-registry
systemctl status hatpro-resort-api --no-pager
```
Health check: `curl -s localhost:4326/health; curl -s localhost:4327/health; curl -s localhost:4260/health`

## 5. nginx + TLS
```bash
sudo cp /opt/hatpro-archon/deploy/nginx/hatpro.archon.technology.conf /etc/nginx/sites-available/hatpro
sudo ln -s /etc/nginx/sites-available/hatpro /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hatpro.archon.technology         # TLS
```
DNS: point `hatpro.archon.technology` A record at this server first.

## Verify end-to-end
- `https://hatpro.archon.technology/` → welcome page with links to the three apps.
- `/traveler/` → wallet loads, creates an identity (incognito).
- `/supplier/` → compose request; present in the wallet; verify → ACCEPTED.
- `/registry/` → authorization matrix renders.

## Updating after a code change
```bash
cd /opt/hatpro-archon && git pull
bash deploy/build-apps.sh
sudo systemctl restart hatpro-resort-api hatpro-issuer-api      # if services changed
```

## Concurrency note (demo scale)
`issuer-api` and `resort-api` each hold one keymaster wallet; many simultaneous writers
could race on the wallet file. Fine for a demo with a handful of users; harden (queue or
per-request wallet) before a large public event.
