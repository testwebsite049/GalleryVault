import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { StorageConfig } from "@/lib/db/models/StorageConfig";
import { getGoogleAuthUrl } from "@/lib/storage/googleDrive";

export async function GET() {
  try {
    await dbConnect();
    const config = await StorageConfig.findOne();

    if (
      !config ||
      !config.googleDriveConfig.clientId ||
      !config.googleDriveConfig.redirectUri
    ) {
      return NextResponse.json(
        {
          error: {
            code: "CONFIG_ERROR",
            message: "Google Drive Client ID and Redirect URI must be saved first.",
          },
        },
        { status: 400 }
      );
    }

    const authUrl = getGoogleAuthUrl(
      config.googleDriveConfig.clientId,
      config.googleDriveConfig.redirectUri
    );

    return NextResponse.json({ url: authUrl });
  } catch (err) {
    console.error("Google Auth Redirect Link Error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate Google auth URL." } },
      { status: 500 }
    );
  }
}
