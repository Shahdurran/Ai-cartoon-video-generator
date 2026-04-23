# AI Cartoon Generator — Railway Deployment Guide

This document covers how to deploy the AI Cartoon Generator to Railway as **one
project with four services**:

1. **PostgreSQL** — Railway plugin (adds `DATABASE_URL`).
2. **Redis** — Railway plugin (adds `REDIS_URL`).
3. **Backend** (`/` root, `Dockerfile`) — Node.js/Express + Bull workers.
4. **Frontend** (`web/` root, `web/Dockerfile`) — Next.js 14 standalone.

Backend and frontend are deployed from the same GitHub repo but with different
root directories and Dockerfiles.

---

## 1. Provision Railway services

From the Railway dashboard, inside **one project**:

1. **Add Plugin → PostgreSQL**.
2. **Add Plugin → Redis**.
3. **New Service → GitHub Repo** → choose this repo.
   - Service name: `backend`
   - Root directory: `/`
   - Builder: Dockerfile (auto-detected from `Dockerfile`)
4. **New Service → GitHub Repo** → choose this repo again.
   - Service name: `frontend`
   - Root directory: `web`
   - Builder: Dockerfile (auto-detected from `web/Dockerfile`)

Railway will automatically:

- Inject `DATABASE_URL` from the Postgres plugin into all services in the same
  project.
- Inject `REDIS_URL` from the Redis plugin.
- Generate internal `service.railway.internal` hostnames so the frontend can
  reach the backend privately.

---

## 2. Backend environment variables

Set these on the **backend** service in Railway. Values come from your own
external accounts (Cloudflare, Anthropic, Fal.AI, ElevenLabs, AssemblyAI).

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Auto-injected by Postgres plugin |
| `REDIS_URL` | ✅ | Auto-injected by Redis plugin |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 secret key |
| `R2_BUCKET` | ✅ | Bucket name |
| `R2_PUBLIC_BASE_URL` | optional | If using a public custom domain |
| `ANTHROPIC_API_KEY` | ✅ | Claude |
| `CLAUDE_MODEL` | optional | Defaults to `claude-sonnet-4-6` |
| `FAL_API_KEY` | ✅ | Fal.AI (Flux + Seedance) |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs SDK |
| `ASSEMBLYAI_API_KEY` | ✅ | Subtitles |
| `PORT` | optional | Default `3000`; Railway overrides it |
| `RUN_MIGRATIONS_ON_STARTUP` | recommended | Set `true` for the first deploy; safe to keep on |
| `RUN_SEED_ON_STARTUP` | recommended | Set `true` for the first deploy, then `false` |
| `PG_POOL_MAX` | optional | Default `10` |

After the first successful deploy, set `RUN_SEED_ON_STARTUP=false` so every
restart doesn't re-run the seed script (it is idempotent, but avoiding unneeded
work saves startup time).

### One-time data migration (optional)

If you have legacy JSON projects in `storage/projects/`, run this once against
the live Railway database before flipping users to the new UI:

```bash
# Against the Railway Postgres URL
DATABASE_URL=postgres://... npm run migrate:json
```

---

## 3. Frontend environment variables

Set on the **frontend** service in Railway:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | ✅ | Public backend URL, e.g. `https://backend-production.up.railway.app`. Inlined at build time. |

To use Railway's internal networking instead (recommended for lower latency and
to avoid egress fees), leave `NEXT_PUBLIC_API_URL` empty and proxy requests via
`next.config.js → rewrites`:

```js
// web/next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `http://${process.env.BACKEND_INTERNAL_HOST}:3000/api/:path*`,
    },
  ];
},
```

Then set `BACKEND_INTERNAL_HOST=backend.railway.internal` (the internal hostname
Railway assigns).

---

## 4. Cloudflare R2 setup (once)

1. Create a bucket (e.g. `cartoon-generator`).
2. Create an API token with Object Read & Write permissions scoped to that bucket.
3. (Optional) Configure a public custom domain if you want to serve assets
   without signed URLs. If you do, set `R2_PUBLIC_BASE_URL`; otherwise the
   backend will generate short-lived signed URLs for every asset.
4. Upload the initial style thumbnails to the `styles/` prefix with keys
   matching `src/config/styles.seed.js` (`styles/pixar-3d.png` etc.). You can
   also let the seed run and upload thumbnails later — the UI just shows a
   placeholder until the asset exists.

---

## 5. First deploy checklist

1. Push to GitHub → Railway auto-builds both services.
2. Watch the **backend** logs for:
   - `[migrate] running migration 001_initial_schema.sql`
   - `[seed] seeded N styles, M music tracks`
   - `[server] listening on :3000`
3. Hit `https://<backend>/health` → expect `{ ok: true, ... }`.
4. Hit the frontend URL → landing page should render and `/api/styles` should
   return 4+ styles.
5. Create a test project with a short topic (e.g. `"Why cats rule the internet"`),
   2 scenes, 10-second total duration. Watch the SSE status page light up.

---

## 6. Ongoing operations

- **Scaling workers**: Bull processors run inside the backend container, so
  increasing replicas on Railway scales both HTTP and workers. If workers need
  to scale independently later, split into a dedicated `worker` service with
  the same image but different `CMD` (e.g. `node src/queues/workerOnly.js`).
- **Log inspection**: Railway → backend → Logs. All queue processors log a
  `[cartoon]` prefix.
- **Redis pub/sub**: SSE works out-of-the-box because both HTTP and workers
  share one `REDIS_URL`.
- **Storage cleanup**: `DELETE /api/projects/:id` recursively deletes every R2
  object under that project's prefix.
