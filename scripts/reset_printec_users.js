/**
 * Removes Printoms + legacy Printec users, then seeds Printec staff with
 * role-based @thepolarislabs.com accounts and RBAC staff_role grants.
 *
 * Usage: node scripts/reset_printec_users.js
 */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PRINTOMS_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const PRINTEC_COMPANY_ID = "33333333-3333-3333-3333-333333333333";

const STAFF_USERS = [
  {
    email: "admin@thepolarislabs.com",
    name: "Printec Admin",
    role: "admin",
    staff_role: null,
    phone: "9000000001",
    password: "9000000001",
  },
  {
    email: "marketer@thepolarislabs.com",
    name: "Printec Marketer",
    role: "staff",
    staff_role: "Marketer",
    phone: "9000000002",
    password: "9000000002",
  },
  {
    email: "designer@thepolarislabs.com",
    name: "Printec Designer",
    role: "staff",
    staff_role: "Designer",
    phone: "9000000003",
    password: "9000000003",
  },
  {
    email: "production@thepolarislabs.com",
    name: "Printec Production",
    role: "staff",
    staff_role: "Production",
    phone: "9000000004",
    password: "9000000004",
  },
  {
    email: "installation@thepolarislabs.com",
    name: "Printec Installation",
    role: "staff",
    staff_role: "Installation",
    phone: "9000000005",
    password: "9000000005",
  },
];

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Collect user ids to remove (printoms company + legacy @printec.in)
  const { data: toRemove, error: listError } = await supabase
    .from("users")
    .select("id, email, company_id")
    .or(
      `company_id.eq.${PRINTOMS_COMPANY_ID},email.like.%@printec.in%,email.like.%@printoms.%`
    );

  if (listError) throw listError;

  console.log(`Removing ${toRemove?.length ?? 0} legacy users...`);
  for (const user of toRemove ?? []) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (authDeleteError && !authDeleteError.message.includes("User not found")) {
      console.warn(`  auth delete ${user.email}: ${authDeleteError.message}`);
    }

    const { error: profileDeleteError } = await supabase.from("users").delete().eq("id", user.id);
    if (profileDeleteError) {
      console.warn(`  profile delete ${user.email}: ${profileDeleteError.message}`);
    } else {
      console.log(`  removed ${user.email}`);
    }
  }

  // 2. Seed new Printec users via seed_app_user (auth + profile + RBAC staff_role)
  console.log("\nCreating Printec @thepolarislabs.com users...");
  for (const user of STAFF_USERS) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();

    if (existing) {
      console.log(`  skip (exists): ${user.email}`);
      continue;
    }

    const { data: userId, error: seedError } = await supabase.rpc("seed_app_user", {
      p_email: user.email,
      p_password: user.password,
      p_company_id: PRINTEC_COMPANY_ID,
      p_name: user.name,
      p_role: user.role,
      p_phone: user.phone,
      p_staff_role: user.staff_role,
    });

    if (seedError) {
      console.error(`  failed ${user.email}:`, seedError.message);
      continue;
    }

    console.log(`  created ${user.email} (${user.role}${user.staff_role ? ` / ${user.staff_role}` : ""}) id=${userId}`);
  }

  // 3. Verify
  const { data: finalUsers, error: verifyError } = await supabase
    .from("users")
    .select("email, role, staff_role, status, companies!inner(slug)")
    .eq("company_id", PRINTEC_COMPANY_ID)
    .order("email");

  if (verifyError) throw verifyError;

  console.log("\nPrintec users:");
  for (const u of finalUsers ?? []) {
    console.log(
      `  ${u.email} | ${u.role}${u.staff_role ? ` / ${u.staff_role}` : ""} | ${u.status}`
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
