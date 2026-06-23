import { z } from "zod";

export const saveImageMetadataSchema = z.object({
  folderId: z.string().min(1, "Folder ID is required"),
  folderSlug: z.string().min(1, "Folder slug is required"),
  cloudinaryPublicId: z.string().min(1, "Cloudinary public ID is required"),
  secureUrl: z.string().url("Must be a valid URL"),
  thumbnailUrl: z.string().url("Must be a valid URL"),
  mediumUrl: z.string().url("Must be a valid URL"),
  originalFilename: z.string().min(1, "Original filename is required"),
  format: z.string().min(1, "Format is required"),
  width: z.number().positive(),
  height: z.number().positive(),
  fileSize: z.number().positive(),
});

export const updateImageSchema = z.object({
  altText: z.string().max(200, "Alt text must not exceed 200 characters").nullable().optional(),
  caption: z.string().max(500, "Caption must not exceed 500 characters").nullable().optional(),
});
