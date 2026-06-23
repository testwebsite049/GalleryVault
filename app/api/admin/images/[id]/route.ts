import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Image } from "@/lib/db/models/Image";
import { Folder } from "@/lib/db/models/Folder";
import { updateImageSchema } from "@/lib/validators/image";
import { ZodError } from "zod";
import { cloudinary } from "@/lib/cloudinary/client";

// PATCH /api/admin/images/[id]
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();
    const body = await req.json();

    const image = await Image.findById(params.id);
    if (!image) {
      return NextResponse.json(
        {
          error: {
            code: "IMAGE_NOT_FOUND",
            message: "The requested image does not exist.",
            statusCode: 404,
          },
        },
        { status: 404 }
      );
    }

    // Validate request
    const validated = updateImageSchema.parse(body);

    // Apply updates
    if (validated.altText !== undefined) image.altText = validated.altText;
    if (validated.caption !== undefined) image.caption = validated.caption;

    await image.save();

    return NextResponse.json({ image });
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

    console.error("PATCH Image Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update image metadata.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/images/[id]
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();

    const image = await Image.findById(params.id);
    if (!image) {
      return NextResponse.json(
        {
          error: {
            code: "IMAGE_NOT_FOUND",
            message: "The requested image does not exist.",
            statusCode: 404,
          },
        },
        { status: 404 }
      );
    }

    const folderId = image.folderId;

    // 1. Delete image from Cloudinary
    try {
      await cloudinary.uploader.destroy(image.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error("Failed to delete asset from Cloudinary:", cloudinaryError);
      // Proceed to clean DB even if Cloudinary fails
    }

    // 2. Delete image document from MongoDB
    await Image.findByIdAndDelete(image._id);

    // 3. Update parent folder total count & check cover image
    const folder = await Folder.findById(folderId);
    if (folder) {
      const remainingCount = await Image.countDocuments({ folderId });
      folder.totalImages = remainingCount;

      // If the deleted image was the cover image, pick another one or reset to null
      if (folder.coverImageId && folder.coverImageId.toString() === image._id.toString()) {
        const nextImage = await Image.findOne({ folderId }).sort({ uploadedAt: -1 });
        if (nextImage) {
          folder.coverImageId = nextImage._id as typeof folder.coverImageId;
          folder.coverImageUrl = nextImage.secureUrl;
        } else {
          folder.coverImageId = null;
          folder.coverImageUrl = null;
        }
      }

      await folder.save();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE Image Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete image resource.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
