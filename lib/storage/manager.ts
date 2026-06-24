import { v2 as cloudinary } from "cloudinary";
import {
  uploadToDrive,
  makeFilePublic,
  getDriveFileDetails,
  deleteFromDrive,
  getValidAccessToken,
} from "./googleDrive";
import { StorageConfig } from "@/lib/db/models/StorageConfig";
import { dbConnect } from "@/lib/db/connect";

// Configure Cloudinary SDK credentials
export function configureCloudinary(config: any) {
  cloudinary.config({
    cloud_name: config.cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
    api_key: config.apiKey || process.env.CLOUDINARY_API_KEY || "",
    api_secret: config.apiSecret || process.env.CLOUDINARY_API_SECRET || "",
  });
}

export interface UploadResult {
  secureUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  cloudinaryPublicId?: string | null;
  googleDriveFileId?: string | null;
  storageProvider: "cloudinary" | "google-drive" | "both";
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

// Upload file to the active storage provider(s)
export async function uploadImage(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  folderSlug: string,
  options?: {
    providerOverride?: "cloudinary" | "google-drive" | "both";
    googleDriveFolderId?: string | null;
  }
): Promise<UploadResult> {
  await dbConnect();

  // Find or create default config
  let config = await StorageConfig.findOne();
  if (!config) {
    config = await StorageConfig.create({
      activeProvider: "cloudinary",
      cloudinaryConfig: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
        apiKey: process.env.CLOUDINARY_API_KEY || "",
        apiSecret: process.env.CLOUDINARY_API_SECRET || "",
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "galleryflow",
      },
    });
  }

  const activeProvider = options?.providerOverride || config.activeProvider;
  let cloudinaryRes: any = null;
  let driveFileId: string | null = null;
  let driveDetails: any = null;

  // 1. Upload to Cloudinary if active or both
  if (activeProvider === "cloudinary" || activeProvider === "both") {
    configureCloudinary(config.cloudinaryConfig);
    const uploadPreset = config.cloudinaryConfig.uploadPreset || "galleryflow";

    cloudinaryRes = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `galleryvault/${folderSlug}`,
            upload_preset: uploadPreset,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(fileBuffer);
    });
  }

  // 2. Upload to Google Drive if active or both
  if (activeProvider === "google-drive" || activeProvider === "both") {
    try {
      const accessToken = await getValidAccessToken();
      const parentFolderId = options?.googleDriveFolderId || config.googleDriveConfig.parentFolderId || undefined;

      driveFileId = await uploadToDrive(accessToken, fileBuffer, filename, mimeType, parentFolderId);
      await makeFilePublic(accessToken, driveFileId);
      driveDetails = await getDriveFileDetails(accessToken, driveFileId);
    } catch (driveErr) {
      console.error("Google Drive upload error:", driveErr);
      throw driveErr;
    }
  }

  // 3. Compile and return uniform results
  if (activeProvider === "both" && cloudinaryRes && driveFileId) {
    return {
      secureUrl: cloudinaryRes.secure_url,
      thumbnailUrl: cloudinaryRes.secure_url.replace(
        "/upload/",
        "/upload/w_400,h_400,c_fill,q_auto,f_auto/"
      ),
      mediumUrl: cloudinaryRes.secure_url.replace("/upload/", "/upload/w_800,q_auto,f_auto/"),
      cloudinaryPublicId: cloudinaryRes.public_id,
      googleDriveFileId: driveFileId,
      storageProvider: "both",
      width: cloudinaryRes.width,
      height: cloudinaryRes.height,
      fileSize: cloudinaryRes.bytes,
      format: cloudinaryRes.format || filename.split(".").pop() || "jpg",
    };
  } else if (activeProvider === "google-drive" && driveFileId && driveDetails) {
    const width = driveDetails.imageMediaMetadata?.width || 800;
    const height = driveDetails.imageMediaMetadata?.height || 600;
    const size = Number(driveDetails.size) || fileBuffer.length;
    const format = mimeType.split("/")[1] || "jpg";

    const driveUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
    return {
      secureUrl: driveUrl,
      thumbnailUrl: `${driveUrl}=w400`,
      mediumUrl: `${driveUrl}=w800`,
      cloudinaryPublicId: null,
      googleDriveFileId: driveFileId,
      storageProvider: "google-drive",
      width,
      height,
      fileSize: size,
      format,
    };
  } else if (cloudinaryRes) {
    return {
      secureUrl: cloudinaryRes.secure_url,
      thumbnailUrl: cloudinaryRes.secure_url.replace(
        "/upload/",
        "/upload/w_400,h_400,c_fill,q_auto,f_auto/"
      ),
      mediumUrl: cloudinaryRes.secure_url.replace("/upload/", "/upload/w_800,q_auto,f_auto/"),
      cloudinaryPublicId: cloudinaryRes.public_id,
      googleDriveFileId: null,
      storageProvider: "cloudinary",
      width: cloudinaryRes.width,
      height: cloudinaryRes.height,
      fileSize: cloudinaryRes.bytes,
      format: cloudinaryRes.format || "jpg",
    };
  }

  throw new Error("No active storage provider was able to process the request.");
}

// Delete file from active provider(s)
export async function deleteImage(
  provider: "cloudinary" | "google-drive" | "both",
  cloudinaryPublicId?: string | null,
  googleDriveFileId?: string | null
): Promise<void> {
  await dbConnect();
  const config = await StorageConfig.findOne();

  if ((provider === "cloudinary" || provider === "both") && cloudinaryPublicId) {
    const cloudConfig = config?.cloudinaryConfig;
    configureCloudinary(cloudConfig || {});
    await new Promise<void>((resolve) => {
      cloudinary.uploader.destroy(cloudinaryPublicId, (error) => {
        if (error) console.warn("Cloudinary file delete failed:", error);
        resolve();
      });
    });
  }

  if ((provider === "google-drive" || provider === "both") && googleDriveFileId) {
    try {
      const accessToken = await getValidAccessToken();
      await deleteFromDrive(accessToken, googleDriveFileId);
    } catch (err) {
      console.warn("Google Drive file delete failed:", err);
    }
  }
}
