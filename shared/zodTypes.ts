/**
 * Other Zod types and utils that are not covered by the prisma zod generator
 */
import z from "zod";

export const SettingsKeys = z.literal([
  "closing_doc",
  "personal_data_retention_days",
]);

export const Settings = z.partialRecord(SettingsKeys, z.string());

/**
 * Metadata fields sent alongside the uploaded file in a multipart Document create/update request.
 * `tagIds` arrives as a JSON-stringified array since multipart form fields are plain strings.
 */
export const DocumentMeta = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tagIds: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return [];
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.string())),
});
