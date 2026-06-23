import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { Image } from "@/lib/db/models/Image";
import { updateFolderSchema } from "@/lib/validators/folder";
import { ZodError } from "zod";
import bcrypt from "bcrypt";
import { cloudinary } from "@/lib/cloudinary/client";

// GET /api/admin/folders/[id]
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();
    const folder = await Folder.findById(params.id);

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

    return NextResponse.json({ folder });
  } catch (err) {
    console.error("GET Folder ID Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve folder details.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/folders/[id]
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();
    const body = await req.json();

    const folder = await Folder.findById(params.id);
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

    // Validate request
    const validated = updateFolderSchema.parse(body);

    // If slug is changing, verify it is unique
    if (validated.slug && validated.slug !== folder.slug) {
      const existing = await Folder.findOne({ slug: validated.slug });
      if (existing) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `A folder with slug '${validated.slug}' already exists.`,
              statusCode: 400,
            },
          },
          { status: 400 }
        );
      }
      
      // Update all denormalized slug records on images in the background or sequentially
      await Image.updateMany({ folderId: folder._id }, { folderSlug: validated.slug });
    }

    // Handle password hashing if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...validated };
    delete updateData.password; // Remove plain password

    if (validated.passwordProtected !== undefined) {
      folder.passwordProtected = validated.passwordProtected;
    }

    if (validated.password) {
      updateData.passwordHash = await bcrypt.hash(validated.password, 12);
      updateData.passwordProtected = true;
    } else if (validated.password === null) {
      updateData.passwordHash = null;
      updateData.passwordProtected = false;
    }

    // Manage published timestamp
    if (validated.isPublished !== undefined) {
      if (validated.isPublished && !folder.isPublished) {
        updateData.publishedAt = new Date();
      } else if (!validated.isPublished) {
        updateData.publishedAt = null;
      }
    }

    // Apply updates
    Object.assign(folder, updateData);
    await folder.save();

    return NextResponse.json({ folder });
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

    console.error("PATCH Folder Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update folder settings.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/folders/[id]
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await dbConnect();

    const folder = await Folder.findById(params.id);
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

    // 1. Find all images under this folder
    const images = await Image.find({ folderId: folder._id });
    const publicIds = images.map((img) => img.cloudinaryPublicId);

    // 2. Delete images from Cloudinary in batches of 100 (Cloudinary API limit)
    if (publicIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < publicIds.length; i += batchSize) {
        const batch = publicIds.slice(i, i + batchSize);
        try {
          await cloudinary.api.delete_resources(batch);
        } catch (cloudinaryError) {
          console.error("Failed to delete batch resources from Cloudinary:", cloudinaryError);
          // Continue execution so DB is cleaned up even if Cloudinary fails
        }
      }
    }

    // 3. Delete image documents from MongoDB
    await Image.deleteMany({ folderId: folder._id });

    // 4. Delete the folder itself
    await Folder.findByIdAndDelete(folder._id);

    return NextResponse.json({ success: true, deletedImagesCount: publicIds.length });
  } catch (err) {
    console.error("DELETE Folder Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete folder and its contents.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
