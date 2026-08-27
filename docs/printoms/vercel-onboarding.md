# Vercel onboarding (per client)

One GitHub repo → many Vercel projects. Same `main` branch; env differs.

## Checklist

1. **New project** Vercel → Add New → Project → same repo → name `printoms-{slug}`.
2. **Shared env** paste from `config/env/.env.shared.example` into Production, Preview, Development (Supabase only).
3. **Client env** paste from `config/env/{slug}.env.example` with real secrets.
   - Required: `CLIENT_SLUG`, `NEXT_PUBLIC_CLIENT_SLUG`, unique `PORTAL_SECRET` (do not reuse across projects)
   - WhatsApp vars if messaging is enabled
   - Portal links use the request host automatically (no `NEXT_PUBLIC_SITE_URL`)
4. **Domain** Project → Domains → add client domain.
5. **Redeploy** required after changing any `NEXT_PUBLIC_*` var.
6. **Smoke**
   - Staff login with a user whose `companies.slug` matches the slug
   - Wrong-slug user → “different client workspace”
   - Portal magic link for this company’s customer works
   - Link from another company → “Wrong Workspace”

## Notes

- Shared Supabase is fine; isolation is `company_id` + slug checks.
- Platform footer (“Made with love”) stays Polaris on every deploy do not white-label it.
- Full client kit: [`ADD_CLIENT.md`](./ADD_CLIENT.md).
