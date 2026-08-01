# Multi-Tenant Environment Variables

This directory contains templates for deploying one Next.js codebase to **multiple Vercel projects** (one per client).

## Per project

1. **Shared** — copy [`/.env.shared.example`](./.env.shared.example) (Supabase keys only).
2. **Client** — copy `{slug}.env.example` and fill secrets (`CLIENT_SLUG`, WhatsApp, unique `PORTAL_SECRET`).

Use a **unique `PORTAL_SECRET` per Vercel project** (never share across clients). A leak of one secret must not forge portal tokens on other deploys.

Do **not** commit real `.env` / `.env.local` secrets.

## Local switching

Set in `.env`:

```env
CLIENT_SLUG=printoms
NEXT_PUBLIC_CLIENT_SLUG=printoms
```

Or use npm scripts: `npm run dev:printoms` | `dev:printec` | `dev:board` | `dev:hitech`.

## WhatsApp

`whatsappTemplatePrefix` lives in `src/config/clients/{slug}` (code). Meta must approve templates named `{prefix}{suffix}` for that WABA. See [`docs/printoms/ADD_CLIENT.md`](../../docs/printoms/ADD_CLIENT.md).

## New client

See [`docs/printoms/ADD_CLIENT.md`](../../docs/printoms/ADD_CLIENT.md) and [`docs/printoms/vercel-onboarding.md`](../../docs/printoms/vercel-onboarding.md).
