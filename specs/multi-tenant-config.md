# Multi-Tenant Configuration Architecture

This document outlines the multi-tenant configuration setup introduced to support whitelabeling the platform for different clients (e.g., PrintOMS vs The Board Company), inspired by the phase 1 rollout plan for Vercel multi-tenancy.

## Overview

The platform uses a centralized, scalable configuration directory (`src/config/`) to define client-specific branding, colors, logos, and UI text. This allows a single codebase to serve different clients by simply swapping the active configuration via environment variables at build or runtime.

## Directory Structure

The configuration follows a robust schema-driven and hierarchical override structure:

```text
src/config/
├── schema/
│   ├── index.ts                # Exports schemas
│   ├── clientConfig.ts         # Defines PrintOMSClientConfig (Root type)
│   └── theme.ts                # Defines ThemeColors interface
├── clients/
│   ├── _default/
│   │   └── index.ts            # The base PrintOMS config (populates all keys)
│   └── the-board-company/
│       └── index.ts            # Overrides specific to The Board Company (colors, logo, loading text)
├── registry.ts                 # Maps CLIENT_SLUGs to their respective configuration objects
├── mergeConfig.ts              # Utility to deep-merge the _default config with client overrides
└── loadClientConfig.ts         # Resolves NEXT_PUBLIC_CLIENT_SLUG and returns the finalized config
```

## Schema Details

The configuration is driven by the `PrintOMSClientConfig` interface (`src/config/schema/clientConfig.ts`):

```typescript
import { ThemeColors } from "./theme";

export interface PrintOMSClientConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  logoUrl: string | null;
  loadingText?: string;
  features: {
    enableAdminAssignment: boolean;
  };
}
```

### Key Properties

- **id**: A unique identifier for the client (e.g., `the-board-company`).
- **name**: The display name of the client.
- **colors**: A comprehensive palette (`ThemeColors`) defining primary/secondary brand colors, background surfaces, and specific sidebar states (active, text, background, accents).
- **logoUrl**: The path to the client's logo (e.g., `/clients/theboardcompany/logo.png`). If `null`, a text fallback is used.
- **loadingText**: The text used for splash screens or loading states (e.g., `"THE BOARD COMPANY"`).

## Resolving the Active Client

The active configuration is determined using the `NEXT_PUBLIC_CLIENT_SLUG` environment variable. The `loadClientConfig()` utility retrieves the specified client override from the registry and deep-merges it with the `_default` config.

```typescript
// src/config/loadClientConfig.ts
export function loadClientConfig(): PrintOMSClientConfig {
  const slug = process.env.NEXT_PUBLIC_CLIENT_SLUG || "the-board-company";
  const override = clientRegistry[slug];
  
  if (!override) {
    console.warn(`No client config found for slug: ${slug}. Falling back to default.`);
    return defaultConfig;
  }
  
  return mergeConfig(override);
}
```

## UI Integration

The configuration is seamlessly integrated into the React component tree:

1. **CSS Variables & Theming**: 
   The `ClientThemeProvider` component calls `loadClientConfig()` and injects the defined colors as CSS variables directly onto the `document.documentElement`. This ensures that global styles (like backgrounds, surfaces, and accents) are updated consistently across the app.

2. **Logo Component**:
   The `Logo` component (`src/components/ui/Logo.tsx`) reads the `logoUrl` from the active config to dynamically render the correct branding. It falls back to standard text if no logo is provided. It incorporates smooth scaling CSS transitions.

3. **Loading Screens**:
   Global loading states (such as `app/loading.tsx` and `GlobalNavigationLoader`) consume the `Logo` component, ensuring users see the appropriately branded loading screens rather than generic placeholders.

## Deployment Model

The architecture supports a **"One Codebase, Multiple Vercel Projects"** deployment strategy. 
To deploy a new client:
1. Create their specific configuration in `src/config/clients/{slug}/index.ts`.
2. Register the slug in `src/config/registry.ts`.
3. Create a new Vercel project connected to the `main` branch of the single repository.
4. Set the `NEXT_PUBLIC_CLIENT_SLUG` environment variable in Vercel to match the registered slug.

## Current Limitations (As of Phase 1)

While the visual branding and configuration dynamically swap based on the environment variable, the backend architecture requires further updates (as outlined in `.cursor/plans/printoms_multi-client_config_b9a504fe.plan.md`) before fully supporting multiple clients securely:

1. **Cross-Tenant Login Security**: Supabase authentication and Row Level Security (RLS) are not yet strictly tied to the `NEXT_PUBLIC_CLIENT_SLUG`. A user from "Printec" could technically log into "The Board Company's" Vercel deployment and see their Printec data wrapped in The Board Company's UI. This will be resolved in Phase 7 (company_id validation guard).
2. **Hardcoded UUIDs**: Certain workflows and permissions (e.g., in `src/features/orders/workspace/shared/stageGrants.ts`) still rely on hardcoded Supabase `company_id` UUID strings instead of dynamically reading from the new client configuration. This will be resolved in Phase 3.
3. **Database Slugs**: The Supabase `companies` table lacks a `slug` column to firmly bridge the frontend `NEXT_PUBLIC_CLIENT_SLUG` with the backend `company_id`. This requires a database migration (Phase 0) to ensure the system can securely map a Vercel project to the correct database tenant.
