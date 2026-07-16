# Multi-Tenant Environment Variables

This directory contains the templates for deploying our multi-tenant application to Vercel (or any other hosting platform).

## Deployment Strategy
We deploy a single Next.js codebase to **multiple Vercel projects**, one for each client.

For each Vercel project, you must set:
1. **Shared variables**: The variables inside `.env.shared.example` (these are identical across all clients).
2. **Client-specific variables**: The variables inside `{slug}.env.example` (these are unique to that client).

**Do NOT commit real `.env` or `.env.local` files to git containing secrets.**
