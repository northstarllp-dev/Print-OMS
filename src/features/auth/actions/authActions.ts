"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  canAccessInstallationPortal,
  canAccessProductionPortal,
} from "@/features/orders/workspace/shared/stageGrants";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function adminSignIn(email: string, pass: string) {
  const supabase = await getSupabase();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    return { error: error.message };
  }

  // Fetch role
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("email", email.toLowerCase())
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: "Failed to fetch user role profile." };
  }

  if (profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Unauthorized access. This email is not registered as an Admin." };
  }

  return { success: true };
}

export async function staffSignIn(email: string, pass: string) {
  const supabase = await getSupabase();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    return { error: error.message };
  }

  // Fetch role
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("email", email.toLowerCase())
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: "Failed to fetch user role profile." };
  }

  if (profile.role !== "staff") {
    await supabase.auth.signOut();
    return { error: "Unauthorized access. This email is not registered as a Staff member." };
  }

  return { success: true };
}

/**
 * Floor/kiosk production portal login.
 * Requires tenant floor-portal flag + production stage grant (not staff grants alone).
 */
export async function productionFloorSignIn(email: string, pass: string) {
  const supabase = await getSupabase();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, staff_role, company_id")
    .eq("email", email.toLowerCase())
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: "Failed to fetch user role profile." };
  }

  if (profile.role !== "staff" && profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Unauthorized access." };
  }

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };

  if (!canAccessProductionPortal(actor)) {
    await supabase.auth.signOut();
    return {
      error:
        "This account cannot use the Production Floor portal. Sign in via Staff Portal instead.",
    };
  }

  return { success: true };
}

/**
 * Floor/kiosk installation portal login.
 * Requires tenant floor-portal flag + installation stage grant (not staff grants alone).
 */
export async function installationFloorSignIn(email: string, pass: string) {
  const supabase = await getSupabase();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, staff_role, company_id")
    .eq("email", email.toLowerCase())
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: "Failed to fetch user role profile." };
  }

  if (profile.role !== "staff" && profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Unauthorized access." };
  }

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };

  if (!canAccessInstallationPortal(actor)) {
    await supabase.auth.signOut();
    return {
      error:
        "This account cannot use the Installation Floor portal. Sign in via Staff Portal instead.",
    };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function getUserSession() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentUser() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("email", user.email?.toLowerCase())
    .single();
  return profile;
}

export async function updateUserPassword(password: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { success: true };
}
