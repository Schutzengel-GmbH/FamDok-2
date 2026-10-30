import * as z from "zod";
import { AnswerCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/AnswerCreateManyInput.schema";
import { AnswerScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/AnswerScalarWhereInput.schema";
import { CaseFormResponseScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseFormResponseScalarWhereInput.schema";
import { GeneralFormResponseScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/GeneralFormResponseScalarWhereInput.schema";
import { CaseWhere } from "./case";
import { Wire } from "./common";
import { CreatedByWhere } from "./user";

const AnswerFields = AnswerCreateManyInputObjectZodSchema.pick({
  questionId: true,
  answerBool: true,
  answerDate: true,
  answerInt: true,
  answerNum: true,
  answerText: true,
}).extend({ answerSelectId: z.array(z.number().int()).optional() });

export const AnswerCreate = AnswerFields.strict();
export type AnswerCreate = Wire<typeof AnswerCreate>;

/** Answers without an `id` belong to questions added after the response was submitted. */
export const AnswerUpdate = AnswerFields.extend({
  id: z.string().optional(),
}).strict();
export type AnswerUpdate = Wire<typeof AnswerUpdate>;

/** Body of `POST /case-form-response` */
export const CaseFormResponseCreateRequest = z.strictObject({
  caseId: z.string(),
  caseFormId: z.string(),
  caregiverId: z.string().nullish(),
  childId: z.string().nullish(),
  answers: z.array(AnswerCreate),
});
export type CaseFormResponseCreateRequest = Wire<
  typeof CaseFormResponseCreateRequest
>;

/** Body of `PUT /case-form-response/i/:id` */
export const CaseFormResponseUpdateRequest = z.strictObject({
  caregiverId: z.string().nullish(),
  childId: z.string().nullish(),
  answers: z.array(AnswerUpdate),
});
export type CaseFormResponseUpdateRequest = Wire<
  typeof CaseFormResponseUpdateRequest
>;

/** Body of `POST /general-form/responses` */
export const GeneralFormResponseCreateRequest = z.strictObject({
  generalFormId: z.string(),
  answers: z.array(AnswerCreate),
});
export type GeneralFormResponseCreateRequest = Wire<
  typeof GeneralFormResponseCreateRequest
>;

/** Body of `PUT /general-form/responses/i/:id` */
export const GeneralFormResponseUpdateRequest = z.strictObject({
  answers: z.array(AnswerUpdate),
});
export type GeneralFormResponseUpdateRequest = Wire<
  typeof GeneralFormResponseUpdateRequest
>;

export const AnswerWhere = AnswerScalarWhereInputObjectZodSchema.pick({
  questionId: true,
  answerText: true,
  answerNum: true,
  answerInt: true,
  answerDate: true,
  answerSelectId: true,
}).strict();
export type AnswerWhere = Wire<typeof AnswerWhere>;

/** One entry per filtered question: a single answer can't match the filters of several. */
const AnswerFilters = z
  .array(z.strictObject({ answers: z.strictObject({ some: AnswerWhere }) }))
  .optional();

/** What case form responses can be filtered by, see {@link CaseWhere}. */
export const CaseFormResponseWhere =
  CaseFormResponseScalarWhereInputObjectZodSchema.pick({
    caseFormId: true,
    caseId: true,
    userId: true,
  })
    .extend({
      case: CaseWhere.optional(),
      createdBy: CreatedByWhere.optional(),
      AND: AnswerFilters,
    })
    .strict();
export type CaseFormResponseWhere = Wire<typeof CaseFormResponseWhere>;

/** Query of `GET /case-form-response` */
export const CaseFormResponseListQuery = z.strictObject({
  where: CaseFormResponseWhere.optional(),
});
export type CaseFormResponseListQuery = Wire<typeof CaseFormResponseListQuery>;

/** What general form responses can be filtered by, see {@link CaseWhere}. */
export const GeneralFormResponseWhere =
  GeneralFormResponseScalarWhereInputObjectZodSchema.pick({
    generalFormId: true,
    userId: true,
  })
    .extend({
      createdBy: CreatedByWhere.optional(),
      AND: AnswerFilters,
    })
    .strict();
export type GeneralFormResponseWhere = Wire<typeof GeneralFormResponseWhere>;

/** Query of `GET /general-form/responses` */
export const GeneralFormResponseListQuery = z.strictObject({
  where: GeneralFormResponseWhere.optional(),
});
export type GeneralFormResponseListQuery = Wire<
  typeof GeneralFormResponseListQuery
>;
