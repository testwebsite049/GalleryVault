import { cloudinary } from "./client";

export interface SignatureResponse {
  signature: string;
  timestamp: number;
  folder: string;
  uploadPreset: string;
  cloudName: string;
  apiKey: string;
}

export function generateUploadSignature(folderSlug: string): SignatureResponse {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "imgweb_signed";
  const folder = `imgweb/${folderSlug}`;

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!apiSecret || !cloudName || !apiKey) {
    throw new Error("Cloudinary environment variables are not fully configured.");
  }

  // The fields signed here must match exactly what the frontend sends to Cloudinary.
  const paramsToSign = {
    folder,
    timestamp,
    upload_preset: uploadPreset,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    folder,
    uploadPreset,
    cloudName,
    apiKey,
  };
}
