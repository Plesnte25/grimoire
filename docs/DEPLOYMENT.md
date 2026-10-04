# Deployment notes

## Frontend asset caching

`npm run build` writes Brotli sidecars for compressible files in `dist/assets`.
Add these directives to the existing Caddy site block that serves the frontend
build, preserving its current `root` and API/reverse-proxy handlers:

```caddyfile
encode zstd gzip

@immutable path /assets/*
header @immutable Cache-Control "public, max-age=31536000, immutable"

@revalidate path / /index.html /sw.js
header @revalidate Cache-Control "no-cache"

file_server {
  precompressed br gzip
}
```

Only content-hashed assets receive long-lived caching. The HTML entry point and
service worker are revalidated so deployments can publish a new version
without leaving clients pinned to stale application code.

## Authenticated browser smoke check

With the app running against a non-production database, install Chromium once
with `cd frontend && npx playwright install chromium`. Then run
`npm run smoke:routes -- --seed` from `frontend/`; the check visits the
authenticated routes at desktop and 320/390/430 px viewports, reporting
console errors, failed requests, and horizontal overflow. `--seed` creates a
temporary trusted device and session in the backend database and removes them
when the check finishes. Do not use it against production. To use an existing
test session instead, set `GRIMOIRE_SMOKE_SESSION` and `GRIMOIRE_SMOKE_DEVICE`,
and optionally `GRIMOIRE_SMOKE_URL`.
