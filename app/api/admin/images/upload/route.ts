import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Image } from "@/lib/db/models/Image";
import { Folder } from "@/lib/db/models/Folder";
import { uploadImage } from "@/lib/storage/manager";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const folderSlug = formData.get("folderSlug") as string | null;

    if (!file || !folderId || !folderSlug) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required upload parameters (file, folderId, folderSlug).",
          },
        },
        { status: 400 }
      );
    }

    // Verify folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return NextResponse.json(
        {
          error: {
            code: "FOLDER_NOT_FOUND",
            message: "Parent folder not found.",
          },
        },
        { status: 404 }
      );
    }

    // Convert File web standard object to Node buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload using Storage Manager
    const uploadResult = await uploadImage(
      fileBuffer,
      file.name,
      file.type,
      folderSlug,
      {
        providerOverride: folder.storageProvider,
        googleDriveFolderId: folder.googleDriveFolderId,
      }
    );

    // Save image metadata record
    const image = await Image.create({
      folderId: folderId,
      folderSlug: folderSlug,
      cloudinaryPublicId: uploadResult.cloudinaryPublicId || null,
      googleDriveFileId: uploadResult.googleDriveFileId || null,
      storageProvider: uploadResult.storageProvider,
      secureUrl: uploadResult.secureUrl,
      thumbnailUrl: uploadResult.thumbnailUrl,
      mediumUrl: uploadResult.mediumUrl,
      originalFilename: file.name,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      aspectRatio: uploadResult.width / uploadResult.height,
      fileSize: uploadResult.fileSize,
      altText: null,
      caption: null,
      viewCount: 0,
      downloadCount: 0,
    });

    // Update parent folder image counts
    folder.totalImages = await Image.countDocuments({ folderId: folder._id });

    // Set default cover image if none configured
    if (!folder.coverImageId) {
      folder.coverImageId = image._id as any;
      folder.coverImageUrl = image.secureUrl;
    }

    await folder.save();

    return NextResponse.json({ image }, { status: 201 });
  } catch (err: any) {
    console.error("Unified Upload API Route Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "Failed to process and upload image.",
        },
      },
      { status: 500 }
    );
  }
}
