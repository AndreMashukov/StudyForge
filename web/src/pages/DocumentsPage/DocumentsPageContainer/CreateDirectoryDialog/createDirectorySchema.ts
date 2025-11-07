import { z } from "zod";

export const createDirectorySchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(50, "Folder name must be 50 characters or less")
    .regex(
      /^[^/\\?*<>|"]+$/,
      'Folder name cannot contain: / \\ ? * < > | "'
    ),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export type CreateDirectoryFormData = z.infer<typeof createDirectorySchema>;
