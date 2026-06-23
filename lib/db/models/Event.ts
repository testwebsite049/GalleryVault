import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvent extends Document {
  folderId: mongoose.Types.ObjectId;
  folderSlug: string;
  eventType: "folder_view" | "image_view" | "download" | "password_attempt";
  imageId?: mongoose.Types.ObjectId | null;
  visitorId: string;
  ip: string; // Hashed IP
  country?: string | null;
  city?: string | null;
  device: "mobile" | "tablet" | "desktop" | "unknown";
  browser: string;
  os: string;
  referrer?: string | null;
  success?: boolean | null; // password verification success/fail
  timestamp: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    folderSlug: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: ["folder_view", "image_view", "download", "password_attempt"],
      required: true,
    },
    imageId: { type: Schema.Types.ObjectId, ref: "Image", default: null },
    visitorId: { type: String, required: true },
    ip: { type: String, required: true },
    country: { type: String, default: null },
    city: { type: String, default: null },
    device: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown",
    },
    browser: { type: String, default: "unknown" },
    os: { type: String, default: "unknown" },
    referrer: { type: String, default: null },
    success: { type: Boolean, default: null },
    timestamp: {
      type: Date,
      default: Date.now,
      expires: 90 * 24 * 60 * 60, // 90 days TTL (automatically pruned by MongoDB)
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound indexes
EventSchema.index({ folderId: 1, timestamp: -1 });
EventSchema.index({ visitorId: 1, folderId: 1 });

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
