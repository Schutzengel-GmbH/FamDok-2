import * as z from "zod";
import { Wire } from "./common";

/**
 * Metadata fields sent alongside the uploaded file in a multipart Document create/update request.
 * `tagIds` arrives as a JSON-stringified array since multipart form fields are plain strings.
 */
export const DocumentMeta = z.strictObject({
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
export type DocumentMeta = Wire<typeof DocumentMeta>;

/** Body of `POST /document/tags` and `PUT /document/tags/i/:id` */
export const TagRequest = z.strictObject({ name: z.string() });
export type TagRequest = Wire<typeof TagRequest>;
