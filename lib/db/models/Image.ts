import mongoose, { Schema, Document, Model } from "mongoose";

export interface IImage extends Document {
  folderId: mongoose.Types.ObjectId;
  folderSlug: string;
  cloudinaryPublicId?: string | null;
  googleDriveFileId?: string | null;
  storageProvider: "cloudinary" | "google-drive" | "both";
  secureUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  originalFilename: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
  viewCount: number;
  downloadCount: number;
  uploadedAt: Date;
}

const ImageSchema = new Schema<IImage>(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    folderSlug: { type: String, required: true, index: true },
    cloudinaryPublicId: { type: String, default: null },
    googleDriveFileId: { type: String, default: null },
    storageProvider: {
      type: String,
      enum: ["cloudinary", "google-drive", "both"],
      default: "cloudinary",
      index: true,
    },
    secureUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    mediumUrl: { type: String, required: true },
    originalFilename: { type: String, required: true },
    format: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: { type: Number, required: true },
    fileSize: { type: Number, required: true },
    altText: { type: String, default: null },
    caption: { type: String, default: null },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "uploadedAt", updatedAt: false },
  }
);

// Compound index for fast paginated gallery query
ImageSchema.index({ folderId: 1, uploadedAt: -1 });

export const Image: Model<IImage> =
  mongoose.models.Image || mongoose.model<IImage>("Image", ImageSchema);
