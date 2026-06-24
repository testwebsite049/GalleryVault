import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { Folder } from "@/lib/db/models/Folder";
import { createFolderSchema } from "@/lib/validators/folder";
import { ZodError } from "zod";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    // Parse filters
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (filter === "published") {
      query.isPublished = true;
    } else if (filter === "draft") {
      query.isPublished = false;
    } else if (filter === "password") {
      query.passwordProtected = true;
    }

    // Build sort options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortOptions: any = {};
    const direction = order === "asc" ? 1 : -1;

    if (sort === "name") {
      sortOptions.name = direction;
    } else if (sort === "views") {
      sortOptions.totalViews = direction;
    } else if (sort === "images") {
      sortOptions.totalImages = direction;
    } else {
      sortOptions.createdAt = direction;
    }

    const folders = await Folder.find(query).sort(sortOptions);

    return NextResponse.json({ folders });
  } catch (err) {
    console.error("GET Folders Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve folders.",
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
    const validated = createFolderSchema.parse(body);

    // Check unique slug
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

    // Handle Google Drive folder creation if selected
    let googleDriveFolderId: string | null = null;
    const storageProvider = validated.storageProvider || "cloudinary";

    if (storageProvider === "google-drive" || storageProvider === "both") {
      try {
        const { getValidAccessToken, createDriveFolder } = await import("@/lib/storage/googleDrive");
        const { StorageConfig } = await import("@/lib/db/models/StorageConfig");
        const config = await StorageConfig.findOne();

        if (!config || !config.googleDriveConfig.refreshToken) {
          return NextResponse.json(
            {
              error: {
                code: "STORAGE_ERROR",
                message: "Google Drive is not connected. Please connect it first in Storage settings.",
                statusCode: 400,
              },
            },
            { status: 400 }
          );
        }

        const accessToken = await getValidAccessToken();
        const parentFolderId = config.googleDriveConfig.parentFolderId || undefined;

        googleDriveFolderId = await createDriveFolder(accessToken, validated.name, parentFolderId);
      } catch (err: any) {
        console.error("Failed to create folder on Google Drive:", err);
        return NextResponse.json(
          {
            error: {
              code: "STORAGE_ERROR",
              message: `Failed to create folder on Google Drive: ${err.message || err}`,
              statusCode: 500,
            },
          },
          { status: 500 }
        );
      }
    }

    // Create folder
    const folder = await Folder.create({
      name: validated.name,
      slug: validated.slug,
      description: validated.description || "",
      storageProvider,
      googleDriveFolderId,
      isPublished: false,
      publishedAt: null,
      passwordProtected: false,
      passwordHash: null,
      allowDownload: true,
      downloadLimit: null,
      allowBulkZip: true,
      watermarkEnabled: false,
      watermarkText: null,
      watermarkPosition: "bottom-right",
      expiresAt: null,
      seoTitle: null,
      seoDescription: null,
      totalImages: 0,
      totalViews: 0,
      totalDownloads: 0,
    });

    return NextResponse.json({ folder }, { status: 201 });
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

    console.error("POST Folders Error:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create folder.",
          statusCode: 500,
        },
      },
      { status: 500 }
    );
  }
}
