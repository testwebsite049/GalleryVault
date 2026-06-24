import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStorageConfig extends Document {
  activeProvider: "cloudinary" | "google-drive" | "both";
  cloudinaryConfig: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    uploadPreset: string;
  };
  googleDriveConfig: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
    parentFolderId?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StorageConfigSchema = new Schema<IStorageConfig>(
  {
    activeProvider: {
      type: String,
      enum: ["cloudinary", "google-drive", "both"],
      default: "cloudinary",
    },
    cloudinaryConfig: {
      cloudName: { type: String, default: "" },
      apiKey: { type: String, default: "" },
      apiSecret: { type: String, default: "" },
      uploadPreset: { type: String, default: "" },
    },
    googleDriveConfig: {
      clientId: { type: String, default: "" },
      clientSecret: { type: String, default: "" },
      redirectUri: { type: String, default: "" },
      accessToken: { type: String, default: null },
      refreshToken: { type: String, default: null },
      expiryDate: { type: Number, default: null },
      parentFolderId: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export const StorageConfig: Model<IStorageConfig> =
  mongoose.models.StorageConfig || mongoose.model<IStorageConfig>("StorageConfig", StorageConfigSchema);
