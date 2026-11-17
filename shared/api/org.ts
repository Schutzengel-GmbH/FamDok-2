import { OrganisationCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/OrganisationCreateManyInput.schema";
import { Wire } from "./common";

/** Body of `POST /org`, `PUT /org/i/:id` and the suborganisation routes below `/org` */
export const OrgRequest = OrganisationCreateManyInputObjectZodSchema.pick({
  name: true,
}).strict();
export type OrgRequest = Wire<typeof OrgRequest>;
