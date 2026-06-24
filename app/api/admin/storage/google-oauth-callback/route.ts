import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { StorageConfig } from "@/lib/db/models/StorageConfig";
import { exchangeAuthCode, createDriveFolder } from "@/lib/storage/googleDrive";

export async function GET(req: Request) {
  // Build a stable base URL from env (works in dev and production)
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${new URL(req.url).protocol}//${new URL(req.url).host}`;

  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth Redirect Error:", error);
      return NextResponse.redirect(`${appBase}/admin/storage?error=consent_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${appBase}/admin/storage?error=missing_code`);
    }

    const config = await StorageConfig.findOne();
    if (
      !config ||
      !config.googleDriveConfig.clientId ||
      !config.googleDriveConfig.clientSecret ||
      !config.googleDriveConfig.redirectUri
    ) {
      return NextResponse.redirect(`${appBase}/admin/storage?error=missing_config`);
    }

    const { clientId, clientSecret, redirectUri } = config.googleDriveConfig;

    // Exchange auth code for tokens
    const tokens = await exchangeAuthCode(clientId, clientSecret, redirectUri, code);

    if (!tokens.access_token) {
      throw new Error("Token exchange returned no access_token. Please try connecting again.");
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token; // Google only sends this on prompt=consent
    const expiryDate = Date.now() + (tokens.expires_in || 3600) * 1000;

    config.googleDriveConfig.accessToken = accessToken;
    if (refreshToken) {
      config.googleDriveConfig.refreshToken = refreshToken;
    }
    config.googleDriveConfig.expiryDate = expiryDate;

    // Automatically create the root GalleryVault directory
    if (!config.googleDriveConfig.parentFolderId) {
      try {
        const rootFolderId = await createDriveFolder(accessToken, "GalleryVault Storage");
        config.googleDriveConfig.parentFolderId = rootFolderId;
      } catch (folderErr) {
        console.error("Failed to automatically create GalleryVault Storage root directory:", folderErr);
      }
    }

    await config.save();

    return NextResponse.redirect(`${appBase}/admin/storage?success=google_connected`);
  } catch (err: any) {
    console.error("Google OAuth Callback Exception:", err);
    return NextResponse.redirect(
      `${appBase}/admin/storage?error=${encodeURIComponent(err.message || "oauth_failed")}`
    );
  }
}

