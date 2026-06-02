# CareerOS

Independent Next.js app for CareerOS workflows.

## Run locally

```bash
cd /Users/globetrotter/Documents/Codex/CareerDryft
npm install
npm run dev
```

Open: `http://localhost:3001`

To run the production server locally:

```bash
npm run build
npm run start
```

## Environment

Create `.env` from the example file:

```bash
cp .env.example .env
```

Then set:

```bash
MAKE_WEBHOOK_URL=https://your-careeros-webhook-url
MAKE_WEBHOOK_TIMEOUT_MS=30000
```

If `MAKE_WEBHOOK_URL` is blank, the app falls back to local demo data.

## Included

- Ask CareerOS chat surface
- `POST /api/careeros` webhook route
- Career pathway visual renderer
- Role map visual renderer
- Local fallback data and timeout handling
