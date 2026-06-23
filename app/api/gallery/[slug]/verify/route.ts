import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Event } from "@/lib/db/models/Event";
import { signJWT } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/ratelimit";
import bcrypt from "bcrypt";
import { UAParser } from "ua-parser-js";

async function hashIP(ip: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();
    const { slug } = params;
    const body = await req.json();
    const { password } = body;

    // Get client IP address
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || "127.0.0.1" : "127.0.0.1";

    // 1. Check Rate Limit (5 attempts / 15 minutes per IP for this specific gallery)
    const limitResult = await rateLimit(ip, `pw_verify:${slug}`, 5, 15 * 60);
    if (!limitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many failed password attempts. Please try again in 15 minutes.",
            statusCode: 429,
          },
        },
        { status: 429 }
      );
    }

    // 2. Fetch folder
    const folder = await Folder.findOne({ slug });
    if (!folder) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_NOT_FOUND",
            message: "The requested folder does not exist.",
            statusCode: 404,
          },
        },
        { status: 404 }
      );
    }

    if (!folder.passwordProtected || !folder.passwordHash) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "This folder does not require password verification.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    // 3. Verify Password
    const isMatch = await bcrypt.compare(password || "", folder.passwordHash);

    // Parse user agent for device analytics
    const userAgent = req.headers.get("user-agent") || "";
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    
    let deviceType: "mobile" | "tablet" | "desktop" | "unknown" = "unknown";
    if (ua.device.type === "mobile") deviceType = "mobile";
    else if (ua.device.type === "tablet") deviceType = "tablet";
    else if (userAgent && !ua.device.type) deviceType = "desktop";

    const hashedIP = await hashIP(ip);
    
    // Log event in database
    await Event.create({
      folderId: folder._id,
      folderSlug: folder.slug,
      eventType: "password_attempt",
      visitorId: req.headers.get("sec-ch-ua") || "anonymous", // Fallback visitor identifier
      ip: hashedIP,
      country: req.headers.get("x-vercel-ip-country") || null,
      city: req.headers.get("x-vercel-ip-city") || null,
      device: deviceType,
      browser: ua.browser.name || "unknown",
      os: ua.os.name || "unknown",
      referrer: req.headers.get("referer") || null,
      success: isMatch,
      timestamp: new Date(),
    });

    if (!isMatch) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_PASSWORD_INCORRECT",
            message: "Incorrect password. Please try again.",
            statusCode: 401,
          },
        },
        { status: 401 }
      );
    }

    // 4. Generate signed session token (expires in 24 hours)
    const token = await signJWT(
      { slug, authorized: true },
      process.env.JWT_SECRET || "",
      24 * 3600 // 24 hours
    );

    const response = NextResponse.json({ success: true });
    
    // 5. Set session cookie
    response.cookies.set(`gallery_session_${slug}`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 3600, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("POST Verify Password Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify password.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
