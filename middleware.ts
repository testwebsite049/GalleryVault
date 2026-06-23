import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "./lib/auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protect Admin API Routes (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    const token = request.cookies.get("admin_session")?.value;
    const secret = process.env.JWT_SECRET || "";

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication is required to access this resource.",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token, secret);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INVALID",
            message: "Authentication token is invalid or expired.",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // 2. Protect Admin Frontend Pages (/admin/*)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("admin_session")?.value;
    const secret = process.env.JWT_SECRET || "";

    let authenticated = false;
    if (token) {
      const payload = await verifyJWT(token, secret);
      if (payload && payload.role === "admin") {
        authenticated = true;
      }
    }

    if (!authenticated) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
