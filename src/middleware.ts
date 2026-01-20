import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  const isOnAdmin = request.nextUrl.pathname.startsWith("/admin");
  const isOnLogin = request.nextUrl.pathname === "/login";

  // Protect admin routes - redirect to login if no session
  if (isOnAdmin && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Redirect logged in users away from login
  if (isOnLogin && sessionCookie) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
