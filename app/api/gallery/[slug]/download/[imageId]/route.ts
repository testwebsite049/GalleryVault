import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { verifyJWT, signJWT } from "@/lib/auth/jwt";

export async function GET(
  req: Request,
  props: { params: Promise<{ slug: string; imageId: string }> }
) {
  const params = await props.params;
  const { slug, imageId } = params;

  try {
    await dbConnect();

    // 1. Fetch folder
    const folder = await Folder.findOne({ slug });
    if (!folder || !folder.isPublished) {
      return NextResponse.redirect(new URL(`/${slug}?error=not_found`, req.url));
    }

    // 2. Check expiry
    if (folder.expiresAt && new Date(folder.expiresAt) < new Date()) {
      return NextResponse.redirect(new URL(`/${slug}?error=expired`, req.url));
    }

    // 3. Verify password permission
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
        return NextResponse.redirect(new URL(`/${slug}?error=password_required`, req.url));
      }
    }

    // 4. Verify downloads are allowed
    if (!folder.allowDownload) {
      return NextResponse.redirect(new URL(`/${slug}?error=downloads_disabled`, req.url));
    }

    // 5. Enforce download limits per visitor session
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => c.trim().split("="))
    );
    const limitToken = cookies[`download_count_${slug}`];
    const secret = process.env.JWT_SECRET || "";

    let currentDownloads = 0;
    if (limitToken) {
      const payload = await verifyJWT(limitToken, secret);
      if (payload && payload.slug === slug) {
        currentDownloads = Number(payload.count) || 0;
      }
    }

    if (folder.downloadLimit !== null && folder.downloadLimit !== undefined) {
      if (currentDownloads >= folder.downloadLimit) {
        return NextResponse.redirect(new URL(`/${slug}?error=limit_reached`, req.url));
      }
    }

    // 6. Fetch image metadata
    const image = await Image.findById(imageId);
    if (!image || image.folderSlug !== slug) {
      return NextResponse.redirect(new URL(`/${slug}?error=image_not_found`, req.url));
    }

    // 7. Increment download counters
    image.downloadCount += 1;
    await image.save();

    folder.totalDownloads += 1;
    await folder.save();

    // 8. Stream the file from Cloudinary and return as direct download response
    const cloudRes = await fetch(image.secureUrl);
    if (!cloudRes.ok) {
      throw new Error(`Failed to fetch original file from storage provider: ${cloudRes.statusText}`);
    }

    const fileBuffer = await cloudRes.arrayBuffer();

    const response = new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": cloudRes.headers.get("Content-Type") || "image/jpeg",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(image.originalFilename)}"`,
      },
    });

    // 9. Increment the visitor cookie limit counter (expires in 24 hours)
    const newLimitToken = await signJWT(
      { slug, count: currentDownloads + 1 },
      secret,
      24 * 3600
    );

    response.cookies.set(`download_count_${slug}`, newLimitToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 3600, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Single image download API error:", err);
    return NextResponse.redirect(new URL(`/${slug}?error=download_error`, req.url));
  }
}
