import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { loadClientConfig } from "@/config/loadClientConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function loginPathFor(path: string): string {
  if (path.startsWith("/production")) return "/production/login";
  if (path.startsWith("/installation")) return "/installation/login";
  if (path.startsWith("/staff")) return "/staff/login";
  return "/admin/login";
}

function canAccessPath(
  path: string,
  role: string | undefined
): boolean {
  if (!role) return false;
  if (path.startsWith("/admin")) return role === "admin";
  if (path.startsWith("/staff")) return role === "staff";
  // Floor portals: staff or admin
  if (path.startsWith("/production") || path.startsWith("/installation")) {
    return role === "staff" || role === "admin";
  }
  return false;
}

function homePathForLogin(loginPath: string): string {
  if (loginPath === "/admin/login") return "/admin/dashboard";
  if (loginPath === "/staff/login") return "/staff/orders";
  if (loginPath === "/production/login") return "/production/orders";
  if (loginPath === "/installation/login") return "/installation/orders";
  return "/";
}

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase environment variables are missing. Skipping session update.");
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can write a secure cookie.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Note: with basePath, Next strips the prefix before middleware — paths are
    // like /admin/... not /printoms/admin/...
    const path = request.nextUrl.pathname;
    const isAdminRoute = path.startsWith("/admin");
    const isStaffRoute = path.startsWith("/staff");
    const isProductionRoute = path.startsWith("/production");
    const isInstallationRoute = path.startsWith("/installation");
    const isProtectedRoute =
      isAdminRoute || isStaffRoute || isProductionRoute || isInstallationRoute;
    const isLoginPage =
      path === "/admin/login" ||
      path === "/staff/login" ||
      path === "/production/login" ||
      path === "/installation/login" ||
      path === "/login";

    if (!isProtectedRoute && !isLoginPage) {
      return supabaseResponse;
    }

    const clientId = loadClientConfig().id;

    let role: string | undefined;
    let tenantOk = false;

    if (user?.email) {
      const { data: profile } = await supabase
        .from("users")
        .select("role, companies!inner(slug)")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();

      role = profile?.role as string | undefined;
      const slug = (profile as { companies?: { slug?: string } } | null)?.companies
        ?.slug;
      // Same tenant gate as getCurrentUser() — mismatch must not bounce login↔dashboard.
      tenantOk = !!slug && slug === clientId;
    }

    const redirectTo = (pathname: string) => {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      return NextResponse.redirect(url);
    };

    // Unauthenticated → login
    if (isProtectedRoute && !isLoginPage && !user) {
      return redirectTo(loginPathFor(path));
    }

    // Authenticated but wrong tenant / role for this portal → login (do NOT loop)
    if (isProtectedRoute && !isLoginPage && user) {
      if (!tenantOk || !canAccessPath(path, role)) {
        return redirectTo(loginPathFor(path));
      }
    }

    // Login page: only auto-enter portal when tenant + role both match this login.
    if (isLoginPage && user) {
      if (tenantOk && canAccessPath(homePathForLogin(path), role)) {
        return redirectTo(homePathForLogin(path));
      }
      // Wrong tenant/role (or staff on admin login): stay on login — breaks the loop.
    }
  } catch (error) {
    console.error("Failed to update supabase session in middleware:", error);
  }

  return supabaseResponse;
};
