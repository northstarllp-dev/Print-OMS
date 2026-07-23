# Multi-Tenant Configuration Architecture

The platform whitelabels via `src/config/` and isolates data with `company_id` + deploy `CLIENT_SLUG`.

## Overview

| Concern | Mechanism |
|---------|-----------|
| Deploy identity | `CLIENT_SLUG` / `NEXT_PUBLIC_CLIENT_SLUG` → `loadClientConfig().id` |
| Data identity | `loadClientConfig().companyId` ↔ `public.companies.id` / row `company_id` |
| Staff login | Rejects when `users.companies.slug !==` deploy slug |
| Portal | Dual auth: valid magic link/session **and** customer/order `company_id ===` deploy `companyId` |
| Branding (tenant) | Logo, colors, name from client config |
| Branding (platform) | Fixed “Made with love” Polaris footer on every slug (`PlatformMadeWithLove`) |

## Directory structure

```text
src/config/
├── schema/
│   ├── clientConfig.ts       # PrintOMSClientConfig (companyId, workflow, WhatsApp prefix, …)
│   ├── theme.ts
│   └── features.ts
├── clients/
│   ├── printoms/
│   ├── the-board-company/
│   ├── printec/
│   ├── hitech-vision/
│   └── _template/            # Scaffold for new clients
├── registry.ts
├── mergeConfig.ts
└── loadClientConfig.ts       # getDeployCompanyId()
```

## Adding a client

See **[docs/printoms/ADD_CLIENT.md](../docs/printoms/ADD_CLIENT.md)** — config + DB row + env + Vercel only; no core feature edits.

## Schema (high level)

```typescript
interface PrintOMSClientConfig {
  id: string;                 // slug
  name: string;
  companyId: string;          // companies.id UUID
  companyIds?: string[];
  colors: ThemeColors;
  logoUrl: string | null;
  faviconUrl?: string | null;
  features: FeaturesConfig;
  usesFloorPortals?: boolean;
  stageGrantsByRole?: Record<string, RoleStageGrantMapConfig>;
  whatsappTemplatePrefix?: string;
}
```

## Security notes

- Never fall back to a hardcoded Printoms UUID when writing rows — use profile `company_id` or `getDeployCompanyId()`.
- Portal admin-client reads/writes must go through `assertPortalTenantAccess` / `assertCompanyMatchesDeploy`.
- RLS remains the DB boundary; slug + companyId checks are application defense-in-depth.
