import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Proxy (pengganti middleware, Next 16) — guard rute ringan.
 *  - Path protected tanpa cookie sesi yang sesuai → redirect /login.
 *  - Path tidak dikenal (bukan halaman/app-route legal) → 404.
 *
 * CATATAN: ini hanya guard UX; keamanan sebenarnya tetap di route handler
 * (Better Auth session) & server action.
 */
const APP_COOKIE = "microrad_app.session_token";
const PORTAL_COOKIE = "microrad_portal.session_token";

/** Daftar prefix route yang legal di aplikasi */
const KNOWN_ROUTES = [
  "/login",
  "/dashboard",
  "/customers",
  "/profiles",
  "/routers",
  "/sessions",
  "/billing",
  "/users",
  "/roles",
  "/logs",
  "/settings",
  "/portal",
  "/api",
  "/_next",
  "/favicon.ico",
];

function isKnownRoute(pathname: string): boolean {
  if (pathname === "/") return true; // redirect ke /login di page.tsx
  return KNOWN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAppSession = request.cookies.has(APP_COOKIE);
  const hasPortalSession = request.cookies.has(PORTAL_COOKIE);

  // ── 1. Path root (/) ──
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (hasAppSession) {
      url.pathname = "/dashboard";
    } else if (hasPortalSession) {
      url.pathname = "/portal";
    } else {
      url.pathname = "/login";
    }
    return NextResponse.redirect(url);
  }

  // ── 2. Path tidak dikenal → 404 ──
  if (!isKnownRoute(pathname)) {
    return NextResponse.json(
      { error: "Halaman tidak ditemukan." },
      { status: 404 },
    );
  }

  // ── 3. Halaman Login: Jika sudah login, redirect langsung ──
  if (pathname === "/login") {
    if (hasAppSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (hasPortalSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/portal/login") {
    if (hasPortalSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
    if (hasAppSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── 4. /portal → butuh sesi portal ──
  if (pathname.startsWith("/portal")) {
    if (!hasPortalSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── 5. Area dashboard (semua halaman non-portal) → butuh sesi app ──
  if (!pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    if (!hasAppSession) {
      const url = request.nextUrl.clone();
      // Jika yang login adalah customer portal, arahkan langsung ke /portal
      if (hasPortalSession) {
        url.pathname = "/portal";
      } else {
        url.pathname = "/login";
      }
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Jalankan di semua rute kecuali asset statis & API:
     * - skip _next/static, _next/image, file statis (png/jpg/svg/dll)
     * - API tetap lolos (route handler mengurus auth-nya sendiri); proxy
     *   tetap menjalankan cek 404 untuk path API yang tidak dikenal.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
