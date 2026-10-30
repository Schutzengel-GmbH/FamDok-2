import * as z from "zod";
import { ContactDocumentationScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/ContactDocumentationScalarWhereInput.schema";
import { CaseWhere } from "./case";
import { Wire } from "./common";

/** Statistics are anonymous, so nothing may be filtered by family */
export const AnonCaseWhere = CaseWhere.omit({ family: true }).strict();
export type AnonCaseWhere = Wire<typeof AnonCaseWhere>;

const ActiveBetween = z.strictObject({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

/** Query of `GET /stats/case` and `GET /stats/case/count` */
export const StatsCaseQuery = z.strictObject({
  where: AnonCaseWhere.optional(),
  activeBetween: ActiveBetween.optional(),
});
export type StatsCaseQuery = Wire<typeof StatsCaseQuery>;

/** Query of `GET /stats/contactDocumentation` */
export const StatsContactDocumentationQuery = z.strictObject({
  caseFilter: AnonCaseWhere.optional(),
  docFilter: ContactDocumentationScalarWhereInputObjectZodSchema.pick({
    date: true,
  })
    .strict()
    .optional(),
});
export type StatsContactDocumentationQuery = Wire<
  typeof StatsContactDocumentationQuery
>;
