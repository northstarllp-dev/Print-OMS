/** Shared seed credentials must match supabase/seed.sql */

export const PRINTOMS_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
export const PRINTEC_COMPANY_ID = "33333333-3333-3333-3333-333333333333";

export const SEED_PASSWORD = "TestPass123!";

export const seedUsers = {
  admin: {
    email: "admin@printoms.test",
    password: SEED_PASSWORD,
    name: "Priya Admin",
    role: "admin" as const,
    portal: "admin" as const,
  },
  marketer: {
    email: "marketer@printoms.test",
    password: SEED_PASSWORD,
    name: "Arjun Marketer",
    role: "staff" as const,
    staffRole: "Marketer",
    portal: "staff" as const,
  },
  designer: {
    email: "designer@printoms.test",
    password: SEED_PASSWORD,
    name: "Meera Designer",
    role: "staff" as const,
    staffRole: "Designer",
    portal: "staff" as const,
  },
  production: {
    email: "production@printoms.test",
    password: SEED_PASSWORD,
    name: "Ravi Production",
    role: "staff" as const,
    staffRole: "Production",
    portal: "production" as const,
  },
  installation: {
    email: "installation@printoms.test",
    password: SEED_PASSWORD,
    name: "Karan Installation",
    role: "staff" as const,
    staffRole: "Installation",
    portal: "installation" as const,
  },
  printecAdmin: {
    email: "admin@printec.test",
    password: SEED_PASSWORD,
    name: "Printec Admin",
    role: "admin" as const,
    portal: "admin" as const,
  },
} as const;

export type SeedUserKey = keyof typeof seedUsers;
