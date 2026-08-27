/**
 * Sync Printoms (@thepolarislabs.com) + Printec demo (@printec.in) staff users.
 *
 * - Moves/creates polarislabs accounts under Printoms company (1111…)
 * - Creates printec.in demo accounts under Printec company (3333…)
 *
 * Usage:
 *   node scripts/reset_printec_users.js          # uses .env (dev)
 *   # or override URL + service key for prod
 */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PRINTOMS_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const PRINTEC_COMPANY_ID = "33333333-3333-3333-3333-333333333333";

const PRINTOMS_USERS = [
  {
    email: "admin@thepolarislabs.com",
    name: "Printoms Admin",
    role: "admin",
    staff_role: null,
    phone: "9000000001",
    password: "9000000001",
  },
  {
    email: "marketer@thepolarislabs.com",
    name: "Printoms Marketer",
    role: "staff",
    staff_role: "Marketer",
    phone: "9000000002",
    password: "9000000002",
  },
  {
    email: "designer@thepolarislabs.com",
    name: "Printoms Designer",
    role: "staff",
    staff_role: "Designer",
    phone: "9000000003",
    password: "9000000003",
  },
  {
    email: "production@thepolarislabs.com",
    name: "Printoms Production",
    role: "staff",
    staff_role: "Production",
    phone: "9000000004",
    password: "9000000004",
  },
  {
    email: "installation@thepolarislabs.com",
    name: "Printoms Installation",
    role: "staff",
    staff_role: "Installation",
    phone: "9000000005",
    password: "9000000005",
  },
];

const PRINTEC_DEMO_USERS = [
  {
    email: "admin@printec.in",
    name: "Printec Admin",
    role: "admin",
    staff_role: null,
    phone: "9000000001",
    password: "9000000001",
  },
  {
    email: "staff@printec.in",
    name: "Printec Staff",
    role: "staff",
    staff_role: "Marketer",
    phone: "9000000002",
    password: "9000000002",
    // Legacy email from older seeds migrate if present
    legacyEmails: ["marketer@printec.in"],
  },
  {
    email: "designer@printec.in",
    name: "Printec Designer",
    role: "staff",
    staff_role: "Designer",
    phone: "9000000003",
    password: "9000000003",
  },
  {
    email: "production@printec.in",
    name: "Printec Production",
    role: "staff",
    staff_role: "Production",
    phone: "9000000004",
    password: "9000000004",
  },
  {
    email: "installation@printec.in",
    name: "Printec Installation",
    role: "staff",
    staff_role: "Installation",
    phone: "9000000005",
    password: "9000000005",
  },
];

async function ensureCompanySlug(supabase, id, slug, name) {
  const { error } = await supabase
    .from("companies")
    .upsert({ id, slug, name }, { onConflict: "id" });
  if (error) {
    // older schemas may not allow upsert name try update slug only
    const { error: updErr } = await supabase.from("companies").update({ slug }).eq("id", id);
    if (updErr) console.warn(`  company slug ${slug}: ${updErr.message}`);
    else console.log(`  company slug set: ${slug}`);
  } else {
    console.log(`  company ok: ${slug}`);
  }
}

async function upsertSeedUser(supabase, user, companyId) {
  const lookupEmails = [user.email, ...(user.legacyEmails || [])];
  let existing = null;
  for (const email of lookupEmails) {
    const { data } = await supabase
      .from("users")
      .select("id, company_id, email")
      .eq("email", email)
      .maybeSingle();
    if (data) {
      existing = data;
      break;
    }
  }

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({
        company_id: companyId,
        name: user.name,
        role: user.role,
        staff_role: user.staff_role,
        phone: user.phone,
        email: user.email,
        status: "Active",
      })
      .eq("id", existing.id);

    if (error) {
      console.error(`  update failed ${user.email}:`, error.message);
      return;
    }

    // Keep password + auth email in sync for demo accounts
    const { error: pwErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email: user.email,
      email_confirm: true,
    });
    if (pwErr) console.warn(`  password/email update ${user.email}: ${pwErr.message}`);

    const migrated =
      existing.email !== user.email ? ` (migrated from ${existing.email})` : "";
    console.log(
      `  updated ${user.email} → company ${companyId.slice(0, 8)}… (${user.role}${user.staff_role ? ` / ${user.staff_role}` : ""})${migrated}`
    );
    return;
  }

  const { data: userId, error: seedError } = await supabase.rpc("seed_app_user", {
    p_email: user.email,
    p_password: user.password,
    p_company_id: companyId,
    p_name: user.name,
    p_role: user.role,
    p_phone: user.phone,
    p_staff_role: user.staff_role,
  });

  if (seedError) {
    console.error(`  create failed ${user.email}:`, seedError.message);
    return;
  }
  console.log(
    `  created ${user.email} (${user.role}${user.staff_role ? ` / ${user.staff_role}` : ""}) id=${userId}`
  );
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  console.log(`Target: ${SUPABASE_URL}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\nEnsuring company slugs...");
  await ensureCompanySlug(supabase, PRINTOMS_COMPANY_ID, "printoms", "Printoms");
  await ensureCompanySlug(supabase, PRINTEC_COMPANY_ID, "printec", "Printec");

  console.log("\nPrintoms @thepolarislabs.com → company 1111…");
  for (const user of PRINTOMS_USERS) {
    await upsertSeedUser(supabase, user, PRINTOMS_COMPANY_ID);
  }

  console.log("\nPrintec demo @printec.in → company 3333…");
  for (const user of PRINTEC_DEMO_USERS) {
    await upsertSeedUser(supabase, user, PRINTEC_COMPANY_ID);
  }

  console.log("\nVerify Printoms:");
  const { data: printomsUsers } = await supabase
    .from("users")
    .select("email, role, staff_role, companies!inner(slug)")
    .eq("company_id", PRINTOMS_COMPANY_ID)
    .order("email");
  for (const u of printomsUsers ?? []) {
    console.log(`  ${u.email} | ${u.role}${u.staff_role ? ` / ${u.staff_role}` : ""} | ${(u.companies).slug}`);
  }

  console.log("\nVerify Printec:");
  const { data: printecUsers } = await supabase
    .from("users")
    .select("email, role, staff_role, companies!inner(slug)")
    .eq("company_id", PRINTEC_COMPANY_ID)
    .order("email");
  for (const u of printecUsers ?? []) {
    console.log(`  ${u.email} | ${u.role}${u.staff_role ? ` / ${u.staff_role}` : ""} | ${(u.companies).slug}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
