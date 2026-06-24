import { z } from "zod";

// Slug regex matching: lowercase alphanumeric and hyphens only, no double hyphens, no trailing/leading hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createFolderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(60, "Slug must not exceed 60 characters")
    .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  storageProvider: z.enum(["cloudinary", "google-drive", "both"]).optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(60, "Slug must not exceed 60 characters")
    .regex(slugRegex, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().max(500, "Description must not exceed 500 characters").optional().nullable(),
  coverImageId: z.string().nullable().optional(),
  coverImageUrl: z.string().url("Must be a valid URL").nullable().optional(),
  isPublished: z.boolean().optional(),
  passwordProtected: z.boolean().optional(),
  password: z.string().min(4, "Password must be at least 4 characters").optional().nullable(),
  allowDownload: z.boolean().optional(),
  downloadLimit: z.number().int().min(1).nullable().optional(),
  allowBulkZip: z.boolean().optional(),
  watermarkEnabled: z.boolean().optional(),
  watermarkText: z.string().max(50, "Watermark text must not exceed 50 characters").optional().nullable(),
  watermarkPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  seoTitle: z.string().max(100, "SEO Title must not exceed 100 characters").optional().nullable(),
  seoDescription: z.string().max(200, "SEO Description must not exceed 200 characters").optional().nullable(),
});
