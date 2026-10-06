# SpeedEcom Frontend

React 19 + Vite + Tailwind SPA (with a Capacitor Android shell). It talks to the
SpeedEcom API over HTTP only. The API lives in the `backend` repo.

## Develop

```bash
npm install
cp .env.production.example .env   # then edit
npm run dev                       # http://localhost:5173
npm run lint
npm run build
```

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL. Defaults to `/api` (the nginx proxy). |
| `VITE_ENABLE_MEESHO_AUTOSYNC` | Feature flag, build time. |
| `VITE_GST_RATE` | GST rate, build time (default 18). |
| `VITE_PAYMENT_OFFSET`, `VITE_PAYMENT_MULTIPLIER` | Payment display adjustments, build time. |

## Docker

The image is built with `--base=/client/` and served by nginx. `nginx.conf`
proxies `/api/` and `/dashboard/` to `http://server:5000`, so the container only
works when it shares a network with the backend's compose stack. The compose
files here join the `speedecom-net` network that the backend stack creates, so
start the backend first.

```bash
docker compose -f local.docker-compose.yml up -d --build   # local
docker compose up -d --build                               # production-style
scripts/deploy-ghcr.sh                                     # build + push to GHCR
```

## Mobile

See [MOBILE_BUILD_GUIDE.md](MOBILE_BUILD_GUIDE.md).

## Commits

A husky pre-commit hook runs ESLint on staged files under `src/`.
