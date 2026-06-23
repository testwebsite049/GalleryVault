import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { verifyJWT } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/ratelimit";
import * as archiverModule from "archiver";
// @ts-ignore
const archiver = archiverModule.default || archiverModule;

export async function POST(
  req: Request,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const { slug } = params;

  try {
    await dbConnect();

    // 1. Fetch folder
    const folder = await Folder.findOne({ slug });
    if (!folder || !folder.isPublished) {
      return new NextResponse("Gallery not found or unpublished.", { status: 404 });
    }

    // 2. Check expiry
    if (folder.expiresAt && new Date(folder.expiresAt) < new Date()) {
      return new NextResponse("Gallery has expired.", { status: 403 });
    }

    // 3. Verify password gate
    if (folder.passwordProtected) {
      const cookieHeader = req.headers.get("cookie") || "";
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => c.trim().split("="))
      );
      const token = cookies[`gallery_session_${slug}`];
      const secret = process.env.JWT_SECRET || "";

      let authorized = false;
      if (token) {
        const payload = await verifyJWT(token, secret);
        if (payload && payload.slug === slug && payload.authorized === true) {
          authorized = true;
        }
      }

      if (!authorized) {
        return new NextResponse("Unauthorized password session.", { status: 401 });
      }
    }

    // 4. Verify bulk ZIP is allowed
    if (!folder.allowDownload || !folder.allowBulkZip) {
      return new NextResponse("ZIP downloads are disabled for this gallery.", { status: 403 });
    }

    // 5. Rate Limit: 1 ZIP download per 10 minutes per IP/Visitor
    // Try parsing visitorId from body, otherwise fallback to IP
    let visitorId = "anonymous";
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.formData();
      visitorId = (body.get("visitorId") as string) || "anonymous";
    } catch (e) {
      // Body might not be form data
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || "127.0.0.1" : "127.0.0.1";
    const limiterKey = visitorId !== "anonymous" ? visitorId : ip;

    const limitResult = await rateLimit(limiterKey, `zip_download:${slug}`, 1, 10 * 60);
    if (!limitResult.success) {
      return new NextResponse("Bulk download is rate limited to 1 request per 10 minutes. Please try again later.", { status: 429 });
    }

    // 6. Fetch image records
    const images = await Image.find({ folderId: folder._id }).sort({ uploadedAt: -1 });
    if (images.length === 0) {
      return new NextResponse("This gallery contains no images to download.", { status: 400 });
    }

    // 7. Increment folder download statistics
    folder.totalDownloads += 1;
    await folder.save();

    // 8. Stream ZIP compilation using archiver and a Web ReadableStream response
    const archive = archiver("zip", { zlib: { level: 6 } }); // Compression level 6 (better speed vs level 9)

    const webStream = new ReadableStream({
      async start(controller) {
        archive.on("data", (chunk: any) => {
          controller.enqueue(chunk);
        });

        archive.on("end", () => {
          controller.close();
        });

        archive.on("error", (err: any) => {
          console.error("ZIP archiver stream error:", err);
          controller.error(err);
        });

        // Loop and add files to ZIP sequentially to prevent heap memory exhaustion
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img) continue;
          
          try {
            const fileRes = await fetch(img.secureUrl);
            if (fileRes.ok) {
              const arrayBuffer = await fileRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              archive.append(buffer, { name: img.originalFilename });
            }
          } catch (fetchErr) {
            console.error(`Failed to fetch image ${img.originalFilename} from Cloudinary:`, fetchErr);
            // Continue packaging remaining files
          }
        }

        archive.finalize();
      },
      cancel() {
        archive.abort();
      }
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-gallery.zip"`,
      },
    });
  } catch (err) {
    console.error("POST Bulk ZIP API error:", err);
    return new NextResponse("Failed to compile ZIP archive.", { status: 500 });
  }
}
