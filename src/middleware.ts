import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** A state-changing request that a browser says came from another site. */
export function isCrossSiteWrite(request: Pick<NextRequest, "method" | "headers" | "nextUrl">): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false; // non-browser clients and same-origin navigations
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  const pathname = request.nextUrl.pathname;

  // Define protected routes
  const isOnAdmin = pathname.startsWith("/admin");
  const isOnAdminApi = pathname.startsWith("/api/admin");
  const isOnLogin = pathname === "/login";

  // Protect admin UI routes - redirect to login if no session
  if (isOnAdmin && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Admin changes must come from this site's own pages (defence in depth on
  // top of the SameSite=Lax session cookie): reject cross-site writes.
  if (isOnAdminApi && isCrossSiteWrite(request)) {
    return NextResponse.json({ error: "Cross-site request blocked", code: "CROSS_SITE" }, { status: 403 });
  }

  // Protect admin API routes - return 401 if no session
  // The actual session verification happens in requireAuth()
  // This is an additional layer of defense
  if (isOnAdminApi && !sessionCookie) {
    return NextResponse.json(
      { error: "Unauthorized - No session" },
      { status: 401 }
    );
  }

  // Redirect logged in users away from login
  if (isOnLogin && sessionCookie) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login"],
};
