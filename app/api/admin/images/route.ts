import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Image } from "@/lib/db/models/Image";
import { Folder } from "@/lib/db/models/Folder";
import { saveImageMetadataSchema } from "@/lib/validators/image";
import { ZodError } from "zod";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing 'folderId' query parameter.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    const images = await Image.find({ folderId }).sort({ uploadedAt: -1 });
    return NextResponse.json({ images });
  } catch (err) {
    console.error("GET Images Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve folder images.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    // Validate request
    const validated = saveImageMetadataSchema.parse(body);

    // Verify folder exists
    const folder = await Folder.findById(validated.folderId);
    if (!folder) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_NOT_FOUND",
            message: "Parent folder not found.",
            statusCode: 404,
          },
        },
        { status: 404 }
      );
    }

    // Save image metadata
    const image = await Image.create({
      folderId: validated.folderId,
      folderSlug: validated.folderSlug,
      cloudinaryPublicId: validated.cloudinaryPublicId,
      secureUrl: validated.secureUrl,
      thumbnailUrl: validated.thumbnailUrl,
      mediumUrl: validated.mediumUrl,
      originalFilename: validated.originalFilename,
      format: validated.format,
      width: validated.width,
      height: validated.height,
      aspectRatio: validated.width / validated.height,
      fileSize: validated.fileSize,
      altText: null,
      caption: null,
      viewCount: 0,
      downloadCount: 0,
    });

    // Update parent folder totals
    folder.totalImages = await Image.countDocuments({ folderId: folder._id });
    
    // Automatically set cover image if none is set
    if (!folder.coverImageId) {
      folder.coverImageId = image._id as any;
      folder.coverImageUrl = image.secureUrl;
    }
    
    await folder.save();

    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: err.issues[0]?.message || "Invalid validation schema",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    console.error("POST Image Metadata Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save image metadata.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
