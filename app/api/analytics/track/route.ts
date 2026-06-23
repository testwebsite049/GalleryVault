import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { Event } from "@/lib/db/models/Event";
import { UAParser } from "ua-parser-js";

async function hashIP(ip: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { folderSlug, eventType, imageId, visitorId } = body;

    if (!folderSlug || !eventType) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing 'folderSlug' or 'eventType' parameters.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    // 1. Fetch folder
    const folder = await Folder.findOne({ slug: folderSlug });
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

    // 2. Parse client info
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || "127.0.0.1" : "127.0.0.1";
    const hashedIP = await hashIP(ip);

    const userAgent = req.headers.get("user-agent") || "";
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    
    let deviceType: "mobile" | "tablet" | "desktop" | "unknown" = "unknown";
    if (ua.device.type === "mobile") deviceType = "mobile";
    else if (ua.device.type === "tablet") deviceType = "tablet";
    else if (userAgent && !ua.device.type) deviceType = "desktop";

    // 3. Create Event record
    await Event.create({
      folderId: folder._id,
      folderSlug: folder.slug,
      eventType,
      imageId: imageId || null,
      visitorId: visitorId || "anonymous",
      ip: hashedIP,
      country: req.headers.get("x-vercel-ip-country") || null,
      city: req.headers.get("x-vercel-ip-city") || null,
      device: deviceType,
      browser: ua.browser.name || "unknown",
      os: ua.os.name || "unknown",
      referrer: req.headers.get("referer") || null,
      timestamp: new Date(),
    });

    // 4. Update denormalized stats
    if (eventType === "folder_view") {
      folder.totalViews += 1;
      await folder.save();
    } else if (eventType === "download") {
      folder.totalDownloads += 1;
      await folder.save();

      if (imageId) {
        await Image.findByIdAndUpdate(imageId, { $inc: { downloadCount: 1 } });
      }
    } else if (eventType === "image_view" && imageId) {
      await Image.findByIdAndUpdate(imageId, { $inc: { viewCount: 1 } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST Track Event Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to record analytics event.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed.",
        statusCode: 405,
      },
    },
    { status: 405 }
  );
}
