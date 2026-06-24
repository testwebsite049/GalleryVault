import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFolder extends Document {
  name: string;
  slug: string;
  description?: string;
  coverImageId?: mongoose.Types.ObjectId | null;
  coverImageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: Date | null;
  passwordProtected: boolean;
  passwordHash?: string | null;
  allowDownload: boolean;
  downloadLimit?: number | null;
  allowBulkZip: boolean;
  watermarkEnabled: boolean;
  watermarkText?: string | null;
  watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  expiresAt?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
  createdAt: Date;
  updatedAt: Date;
  storageProvider: "cloudinary" | "google-drive" | "both";
  googleDriveFolderId?: string | null;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true },
    coverImageId: { type: Schema.Types.ObjectId, ref: "Image", default: null },
    coverImageUrl: { type: String, default: null },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    passwordProtected: { type: Boolean, default: false },
    passwordHash: { type: String, default: null },
    allowDownload: { type: Boolean, default: true },
    downloadLimit: { type: Number, default: null }, // null means unlimited
    allowBulkZip: { type: Boolean, default: true },
    watermarkEnabled: { type: Boolean, default: false },
    watermarkText: { type: String, default: null },
    watermarkPosition: {
      type: String,
      enum: ["top-left", "top-right", "bottom-left", "bottom-right", "center"],
      default: "bottom-right",
    },
    expiresAt: { type: Date, default: null },
    seoTitle: { type: String, default: null },
    seoDescription: { type: String, default: null },
    totalImages: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    storageProvider: {
      type: String,
      enum: ["cloudinary", "google-drive", "both"],
      default: "cloudinary",
    },
    googleDriveFolderId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookups/sorting
FolderSchema.index({ createdAt: -1 });

export const Folder: Model<IFolder> =
  mongoose.models.Folder || mongoose.model<IFolder>("Folder", FolderSchema);
