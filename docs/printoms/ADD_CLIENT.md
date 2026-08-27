# Adding a client

After the multi-client kit is in place, a new tenant should need **config + DB + env + Vercel only** not edits under `src/features/**` or portal auth helpers.

## Prerequisites

- Slug (kebab-case), e.g. `signworld`
- New company UUID (generate a fresh UUID)
- Brand: name, colors, logo, favicon
- Optional: WhatsApp WABA + approved templates under `{prefix}…`
- Optional: stage-grant overrides / floor portals

## Steps

### 1. Scaffold

```bash
npm run client:new -- --slug=signworld --name="Signworld" --company-id=<uuid>
```

Creates:

- `src/config/clients/{slug}/index.ts`
- `config/env/{slug}.env.example`
- `public/clients/{slug}/` (drop logo/favicon here)

### 2. Fill brand + workflow

Edit `src/config/clients/{slug}/index.ts`:

- `companyId` (must match DB)
- `colors`, `logoUrl`, `faviconUrl`, `loadingText`
- `usesFloorPortals`, `stageGrantsByRole` (omit roles to inherit defaults)
- `whatsappTemplatePrefix` (e.g. `signworld_`)

### 3. Register

Add one line to [`src/config/registry.ts`](../../src/config/registry.ts):

```ts
import { signworldConfig } from "./clients/signworld";
// …
"signworld": signworldConfig,
```

### 4. Database (dev, then prod)

```sql
INSERT INTO public.companies (id, slug, name)
VALUES ('…uuid…', 'signworld', 'Signworld')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name;
```

Seed users with `seed_app_user` / your reset script, `company_id` = that UUID.

### 5. Vercel

Follow [`vercel-onboarding.md`](./vercel-onboarding.md) for project `printoms-{slug}`.

### 6. Smoke

- Login as admin/staff for this company on this deploy
- Cross-slug login rejected
- Portal link for this company works; other company’s link rejected
- WhatsApp test if enabled (Meta names must exist)

## Do not

- Hardcode new UUIDs inside `src/features/**`
- Fork portal auth per client
- White-label the platform “Made with love” footer
