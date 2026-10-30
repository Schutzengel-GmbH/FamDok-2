import * as z from "zod";
import { RoleSchema } from "../generated/zod/schemas/enums/Role.schema";
import { UserScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/UserScalarWhereInput.schema";
import { Wire } from "./common";

/** Roles whose data access is scoped to an organisation, so they need one assigned. */
export const ROLES_REQUIRING_ORG = [
  "OrgController",
  "OrgCoordinator",
  "SubOrgCoordinator",
] as const;

/** Roles that work across all organisations, so they must not be assigned to one. */
export const ROLES_WITHOUT_ORG = ["Admin", "Controller"] as const;

/**
 * How a newly created user gets their first password: an invite email sent by Keycloak
 * (set password + verify email), or a one-time temporary password handed out by the admin.
 */
export const UserOnboarding = z.enum(["invite", "tempPassword"]);

/** Body of `POST /user` - an admin creating a user (in Keycloak and the app DB). */
export const UserCreateRequest = z
  .strictObject({
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
export type UserCreateRequest = Wire<typeof UserCreateRequest>;

/** Body of `PUT /user/i/:id` */
export const UserUpdateRequest = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  role: RoleSchema.optional(),
  jobTitle: z.string().nullish(),
  organisationId: z.string().nullish(),
  subOrganisationIds: z.array(z.string()).optional(),
});
export type UserUpdateRequest = Wire<typeof UserUpdateRequest>;

/** Body of `PUT /me` */
export const MeUpdateRequest = z.strictObject({
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
});
export type MeUpdateRequest = Wire<typeof MeUpdateRequest>;

/** Body of `PUT /user/i/:id/enabled` */
export const UserEnabledRequest = z.strictObject({ enabled: z.boolean() });
export type UserEnabledRequest = Wire<typeof UserEnabledRequest>;

/** Query of `GET /user/org/:id` */
export const OrgUsersQuery = z.strictObject({
  where: UserScalarWhereInputObjectZodSchema.pick({ id: true })
    .strict()
    .optional(),
});
export type OrgUsersQuery = Wire<typeof OrgUsersQuery>;

/** Filters records by the organisation and suborganisation of the user who created them. */
export const CreatedByWhere = z.strictObject({
  organisationId: z.string().optional(),
  subOrganisations: z
    .strictObject({ some: z.strictObject({ id: z.string() }) })
    .optional(),
});
export type CreatedByWhere = Wire<typeof CreatedByWhere>;
