# Modernization notes

This project follows a phased plan (security hardening, S3 storage, JSON API, React client, optional EJS removal).

## Environment

See `ENV.example` for variables including `SESSION_SECRET`, `TRUST_PROXY`, `STORAGE_DRIVER`, S3 settings, `CORS_ORIGIN`, and `SERVE_SPA`.

## Pending 2FA login store (`lib/pending-login.js`)

The pending 2FA token map is **in-memory** and does not persist across process restarts or work across multiple Node instances. Before running **multiple app servers** behind a load balancer, replace this with **Redis** or a **database table** so login can complete on any instance.

## Serving the React SPA

1. Build: `npm run build:client` (output in `client/dist`).
2. Set `SERVE_SPA=1` and start the API. The app is served under **`/app`** (Vite `base` is `/app/`).

EJS routes remain the primary UI until you migrate each flow to the SPA.

## S3 migration

With `STORAGE_DRIVER=s3` configured, new uploads go to the bucket. Existing files remain on disk until you run `npm run migrate-uploads-s3` (supports `--dry-run`). Verify objects in the bucket before deleting local copies.

## EJS removal checklist (future)

- [ ] Parity for auth, onboarding, documents, admin, manager flows in React.
- [ ] CSRF strategy for cookie sessions with SPA POSTs.
- [ ] Point production router to `/app` for the SPA and retain API under same host for cookies.
