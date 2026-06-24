import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { StorageConfig } from "@/lib/db/models/StorageConfig";

export async function GET() {
  try {
    await dbConnect();
    let config = await StorageConfig.findOne();

    if (!config) {
      // Create defaults from environment variables
      config = await StorageConfig.create({
        activeProvider: "cloudinary",
        cloudinaryConfig: {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
          apiKey: process.env.CLOUDINARY_API_KEY || "",
          apiSecret: process.env.CLOUDINARY_API_SECRET || "",
          uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "galleryflow",
        },
        googleDriveConfig: {
          clientId: "",
          clientSecret: "",
          redirectUri: "",
          accessToken: null,
          refreshToken: null,
          expiryDate: null,
          parentFolderId: null,
        },
      });
    }

    // Mask secret keys for user-facing safety
    const safeCloudinaryConfig = {
      cloudName: config.cloudinaryConfig.cloudName,
      apiKey: config.cloudinaryConfig.apiKey,
      apiSecret: config.cloudinaryConfig.apiSecret ? "●●●●●●●●●●●●" : "",
      uploadPreset: config.cloudinaryConfig.uploadPreset,
    };

    const safeGoogleDriveConfig = {
      clientId: config.googleDriveConfig.clientId,
      clientSecret: config.googleDriveConfig.clientSecret ? "●●●●●●●●●●●●" : "",
      redirectUri: config.googleDriveConfig.redirectUri,
      isConnected: !!config.googleDriveConfig.refreshToken,
      parentFolderId: config.googleDriveConfig.parentFolderId || "",
    };

    return NextResponse.json({
      activeProvider: config.activeProvider,
      cloudinaryConfig: safeCloudinaryConfig,
      googleDriveConfig: safeGoogleDriveConfig,
    });
  } catch (err) {
    console.error("GET Storage Config Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch storage settings." } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    let config = await StorageConfig.findOne();
    if (!config) {
      config = new StorageConfig();
    }

    if (body.activeProvider) {
      config.activeProvider = body.activeProvider;
    }

    if (body.cloudinaryConfig) {
      const c = body.cloudinaryConfig;
      config.cloudinaryConfig.cloudName = c.cloudName ?? config.cloudinaryConfig.cloudName;
      config.cloudinaryConfig.apiKey = c.apiKey ?? config.cloudinaryConfig.apiKey;
      // Do not overwrite with mask string
      if (c.apiSecret && c.apiSecret !== "●●●●●●●●●●●●") {
        config.cloudinaryConfig.apiSecret = c.apiSecret;
      }
      config.cloudinaryConfig.uploadPreset = c.uploadPreset ?? config.cloudinaryConfig.uploadPreset;
    }

    if (body.googleDriveConfig) {
      const g = body.googleDriveConfig;
      config.googleDriveConfig.clientId = g.clientId ?? config.googleDriveConfig.clientId;
      if (g.clientSecret && g.clientSecret !== "●●●●●●●●●●●●") {
        config.googleDriveConfig.clientSecret = g.clientSecret;
      }
      config.googleDriveConfig.redirectUri = g.redirectUri ?? config.googleDriveConfig.redirectUri;
      config.googleDriveConfig.parentFolderId = g.parentFolderId ?? config.googleDriveConfig.parentFolderId;

      // Force disconnect if requested
      if (g.disconnect) {
        config.googleDriveConfig.accessToken = null;
        config.googleDriveConfig.refreshToken = null;
        config.googleDriveConfig.expiryDate = null;
        config.googleDriveConfig.parentFolderId = null;
      }
    }

    await config.save();

    return NextResponse.json({ message: "Storage settings updated successfully." });
  } catch (err) {
    console.error("PATCH Storage Config Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save storage settings." } },
      { status: 500 }
    );
  }
}
