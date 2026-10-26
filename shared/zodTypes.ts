/**
 * Other Zod types and utils that are not covered by the prisma zod generator
 */
import z from "zod";
import { RoleSchema } from "./generated/zod/schemas/enums/Role.schema";

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

/** Roles whose data access is scoped to an organisation, so they need one assigned. */
export const ROLES_REQUIRING_ORG = [
  "OrgController",
  "OrgCoordinator",
  "SubOrgCoordinator",
] as const;

/**
 * How a newly created user gets their first password: an invite email sent by Keycloak
 * (set password + verify email), or a one-time temporary password handed out by the admin.
 */
export const UserOnboarding = z.enum(["invite", "tempPassword"]);

/** Body of `POST /user` - an admin creating a user (in Keycloak and the app DB). */
export const UserCreateRequest = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    role: RoleSchema,
    jobTitle: z.string().nullish(),
    organisationId: z.string().nullish(),
    subOrganisationIds: z.array(z.string()).default([]),
    onboarding: UserOnboarding,
  })
  .refine(
    (u) =>
      !(ROLES_REQUIRING_ORG as readonly string[]).includes(u.role) ||
      !!u.organisationId,
    { message: "Role requires an organisation", path: ["organisationId"] },
  )
  .refine(
    (u) => u.role !== "SubOrgCoordinator" || u.subOrganisationIds.length > 0,
    {
      message: "SubOrgCoordinator requires a sub-organisation",
      path: ["subOrganisationIds"],
    },
  );

export type UserCreateRequest = z.input<typeof UserCreateRequest>;

export const UserEnabledRequest = z.object({ enabled: z.boolean() });
