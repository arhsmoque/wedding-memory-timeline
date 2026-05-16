import { z } from "zod";

export const mediaTypeSchema = z.enum(["image", "video"]);

export const mediaItemSchema = z.object({
  mediaUrl: z.string().url(),
  mediaPublicId: z.string().min(1),
  mediaType: mediaTypeSchema,
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative().optional()
});

export const entryInputSchema = z.object({
  uploaderName: z.string().trim().min(2).max(40),
  caption: z.string().trim().max(500).default(""),
  mediaUrl: z.string().url(),
  mediaPublicId: z.string().min(1),
  mediaType: mediaTypeSchema,
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
  mediaItems: z.array(mediaItemSchema).min(1).max(5).optional(),
  mediaCount: z.number().int().min(1).max(5).optional(),
  postType: z.enum(["photo", "video"]).optional()
});

export type EntryInput = z.infer<typeof entryInputSchema>;
