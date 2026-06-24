import { dbConnect } from "@/lib/db/connect";
import { StorageConfig } from "@/lib/db/models/StorageConfig";

// Generate Google OAuth 2.0 redirection URL
export function getGoogleAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(
    scopes.join(" ")
  )}&access_type=offline&prompt=consent`;
}

// Exchange OAuth authorization code for tokens
export async function exchangeAuthCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange authorization code: ${errText}`);
  }

  return res.json();
}

// Retrieve valid access token (auto-refresh if expired)
export async function getValidAccessToken(): Promise<string> {
  await dbConnect();
  const config = await StorageConfig.findOne();
  if (!config || !config.googleDriveConfig.clientId || !config.googleDriveConfig.clientSecret) {
    throw new Error("Google Drive credentials are not fully configured in settings.");
  }

  const { accessToken, refreshToken, expiryDate, clientId, clientSecret } = config.googleDriveConfig;

  if (!accessToken || !refreshToken) {
    throw new Error("Google Drive is not authenticated. Please log in first.");
  }

  // Refresh token if expired (or expires in less than 60 seconds)
  if (!expiryDate || expiryDate - 60000 < Date.now()) {
    console.log("Refreshing Google Drive access token...");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to refresh access token: ${errText}`);
    }

    const tokens = await res.json();
    const newAccessToken = tokens.access_token;
    const newExpiryDate = Date.now() + tokens.expires_in * 1000;

    config.googleDriveConfig.accessToken = newAccessToken;
    config.googleDriveConfig.expiryDate = newExpiryDate;
    await config.save();

    return newAccessToken;
  }

  return accessToken;
}

// Create a new folder on Google Drive
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const body: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Drive folder: ${errText}`);
  }

  const data = await res.json();
  return data.id;
}

// Upload a raw binary buffer to Google Drive
export async function uploadToDrive(
  accessToken: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  parentFolderId?: string
): Promise<string> {
  const metadata = {
    name: filename,
    parents: parentFolderId ? [parentFolderId] : undefined,
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const header =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, "utf8"),
    fileBuffer,
    Buffer.from(closeDelimiter, "utf8"),
  ]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": payload.length.toString(),
    },
    body: payload,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload request failed: ${errText}`);
  }

  const data = await res.json();
  return data.id;
}

// Configure file permissions to public read access
export async function makeFilePublic(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to grant public read permission to file: ${errText}`);
  }
}

// Delete file from Google Drive
export async function deleteFromDrive(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return; // File already deleted
    const errText = await res.text();
    throw new Error(`Failed to delete Drive file: ${errText}`);
  }
}

// Fetch file metadata (dimensions, size, mimeType)
export async function getDriveFileDetails(accessToken: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=imageMediaMetadata,size,mimeType,name`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to retrieve file details: ${errText}`);
  }

  return res.json();
}
