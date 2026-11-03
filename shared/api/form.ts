import * as z from "zod";
import { CaseFormCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseFormCreateManyInput.schema";
import { CaseFormScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseFormScalarWhereInput.schema";
import { GeneralFormCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/GeneralFormCreateManyInput.schema";
import { QuestionCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/QuestionCreateManyInput.schema";
import { QuestionScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/QuestionScalarWhereInput.schema";
import { Wire } from "./common";

const SelectOption = z.strictObject({
  id: z.number().int(),
  text: z.string(),
  isOpen: z.boolean().optional(),
});

const QuestionFields = QuestionCreateManyInputObjectZodSchema.pick({
  type: true,
  required: true,
  text: true,
  order: true,
  multiple: true,
  min: true,
  max: true,
  textAreaRows: true,
}).extend({ selectOptions: z.array(SelectOption).optional() });

export const QuestionCreate = QuestionFields.strict();
export type QuestionCreate = Wire<typeof QuestionCreate>;

/** Questions with an `id` are updated in place, so the answers referring to them survive. */
const QuestionUpdates = {
  questions: z
    .array(QuestionFields.extend({ id: z.string().optional() }).strict())
    .optional(),
  deletedQuestionIds: z.array(z.string()).optional(),
};

const CaseFormFields = CaseFormCreateManyInputObjectZodSchema.pick({
  name: true,
  type: true,
  containsPersonalData: true,
  isPersonal: true,
});

/** Body of `POST /case-form-definition` */
export const CaseFormCreateRequest = CaseFormFields.extend({
  questions: z.array(QuestionCreate),
}).strict();
export type CaseFormCreateRequest = Wire<typeof CaseFormCreateRequest>;

/** Body of `PUT /case-form-definition/i/:id` */
export const CaseFormUpdateRequest = CaseFormFields.partial()
  .extend(QuestionUpdates)
  .strict();
export type CaseFormUpdateRequest = Wire<typeof CaseFormUpdateRequest>;

const GeneralFormFields = GeneralFormCreateManyInputObjectZodSchema.pick({
  name: true,
});

/** Body of `POST /general-form/definitions` */
export const GeneralFormCreateRequest = GeneralFormFields.extend({
  questions: z.array(QuestionCreate),
}).strict();
export type GeneralFormCreateRequest = Wire<typeof GeneralFormCreateRequest>;

/** Body of `PUT /general-form/definitions/i/:id` */
export const GeneralFormUpdateRequest = GeneralFormFields.partial()
  .extend(QuestionUpdates)
  .strict();
export type GeneralFormUpdateRequest = Wire<typeof GeneralFormUpdateRequest>;

/** Query of `GET /case-form-definition` */
export const CaseFormListQuery = z.strictObject({
  where: CaseFormScalarWhereInputObjectZodSchema.pick({ id: true, type: true })
    .strict()
    .optional(),
});
export type CaseFormListQuery = Wire<typeof CaseFormListQuery>;

const HasQuestion = z.strictObject({
  questions: z.strictObject({
    some: QuestionScalarWhereInputObjectZodSchema.pick({
      type: true,
      text: true,
    }).strict(),
  }),
});

/** Query of `GET /general-form/definitions`: forms having all of these kinds of questions */
export const GeneralFormListQuery = z.strictObject({
  where: z
    .strictObject({
      AND: z.array(
        z.union([HasQuestion, z.strictObject({ OR: z.array(HasQuestion) })]),
      ),
    })
    .optional(),
});
export type GeneralFormListQuery = Wire<typeof GeneralFormListQuery>;
