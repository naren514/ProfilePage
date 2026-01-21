import { NextRequest, NextResponse } from "next/server";

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

  // Protect admin API routes - return 401 if no session
  // Note: The actual Firebase token verification happens in requireAuth()
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
