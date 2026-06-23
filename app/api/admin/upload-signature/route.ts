import { NextResponse } from "next/server";
import { generateUploadSignature } from "@/lib/cloudinary/uploadSignature";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderSlug = searchParams.get("folderSlug");

    if (!folderSlug) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing 'folderSlug' query parameter.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    // Validate folder slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(folderSlug)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid 'folderSlug' format.",
            statusCode: 400,
          },
        },
        { status: 400 }
      );
    }

    const signatureData = generateUploadSignature(folderSlug);
    return NextResponse.json(signatureData);
  } catch (err) {
    console.error("Signature API Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate upload signature.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
