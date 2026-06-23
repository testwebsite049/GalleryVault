import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { verifyJWT } from "@/lib/auth/jwt";

export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();
    const { slug } = params;

    // 1. Fetch folder
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

    // 2. Check publishing state
    if (!folder.isPublished) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_UNPUBLISHED",
            message: "This folder is currently a draft.",
            statusCode: 404,
          },
        },
        { status: 404 }
      );
    }

    // 3. Check expiration
    if (folder.expiresAt && new Date(folder.expiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_EXPIRED",
            message: "This photo gallery has expired and is no longer available.",
            statusCode: 403,
          },
        },
        { status: 403 }
      );
    }

    // 4. Check password protection
    if (folder.passwordProtected) {
      const cookieName = `gallery_session_${slug}`;
      // Parse cookies manually or via req.headers cookie
      const cookieHeader = req.headers.get("cookie") || "";
      
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => c.trim().split("="))
      );
      
      const token = cookies[cookieName];
      const secret = process.env.JWT_SECRET || "";

      let authorized = false;
      if (token) {
        const payload = await verifyJWT(token, secret);
        if (payload && payload.slug === slug && payload.authorized === true) {
          authorized = true;
        }
      }

      if (!authorized) {
        return NextResponse.json(
          {
            error: {
              code: "FOLDER_PASSWORD_REQUIRED",
              message: "Password verification is required to view this gallery.",
              statusCode: 401,
            },
          },
          { status: 401 }
        );
      }
    }

    // 5. Parse pagination options
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    // 6. Fetch images
    const total = await Image.countDocuments({ folderId: folder._id });
    const images = await Image.find({ folderId: folder._id })
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit);

    const hasMore = skip + images.length < total;

    return NextResponse.json({
      folder: {
        name: folder.name,
        slug: folder.slug,
        description: folder.description,
        coverImageUrl: folder.coverImageUrl,
        allowDownload: folder.allowDownload,
        allowBulkZip: folder.allowBulkZip,
        watermarkEnabled: folder.watermarkEnabled,
        seoTitle: folder.seoTitle,
        seoDescription: folder.seoDescription,
      },
      images,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (err) {
    console.error("GET Public Gallery Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load gallery images.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
