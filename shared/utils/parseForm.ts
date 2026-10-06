import {
  CaseFormCreateInput,
  GeneralFormCreateInput,
  QuestionCreateInput,
} from "../generated/prisma/models";
import {
  CaseFormCreateInputObjectSchema,
  GeneralFormCreateInputObjectSchema,
} from "../generated/zod/schemas";
import { Question } from "../generated/prisma/browser";
import { FullCaseForm, FullGeneralForm } from "../types";
import z from "zod";

/**
 * Parses an uploaded definition and checks its outer shape, so malformed input surfaces as a
 * ZodError rather than a raw SyntaxError/TypeError. The fields themselves are validated by
 * the create-input schemas below.
 */
const FormDefinitionSchema = z
  .string()
  .transform((input, ctx) => {
    try {
      return JSON.parse(input) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  })
  .pipe(z.looseObject({ questions: z.array(z.looseObject({})) }));

/**
 * Stamps each question with its `order` from its position in the definition array, so the
 * persisted sequence doesn't depend on incidental DB insertion/storage order.
 */
function withOrder(questions: Record<string, unknown>[]): QuestionCreateInput[] {
  return questions.map((question, order) => ({
    ...question,
    order,
  })) as QuestionCreateInput[];
}

export function parseCaseForm(formInput: string): CaseFormCreateInput {
  const form = FormDefinitionSchema.parse(formInput);

  const createInput = {
    ...form,
    questions: {
      createMany: { data: withOrder(form.questions) },
    },
    caseFormResponses: undefined,
  };

  const result = CaseFormCreateInputObjectSchema.safeParse(createInput);

  if (!result.success) throw result.error;

  return result.data;
}

export function parseGeneralForm(formInput: string): GeneralFormCreateInput {
  const form = FormDefinitionSchema.parse(formInput);

  const createInput = {
    ...form,
    questions: {
      createMany: { data: withOrder(form.questions) },
    },
    responses: undefined,
  };

  const result = GeneralFormCreateInputObjectSchema.safeParse(createInput);

  if (!result.success) throw result.error;

  return result.data;
}

/**
 * Serializes a question down to only the fields relevant to its type, matching the shape
 * expected by parseCaseForm/parseGeneralForm (see shared/definitions for examples) - i.e.
 * without any DB-only fields (id, answers, caseFormId, generalFormId).
 */
function exportQuestion(question: Question) {
  const data: Record<string, unknown> = {
    text: question.text,
    type: question.type,
    required: !!question.required,
  };

  if (question.type === "Integer" || question.type === "Float") {
    if (question.min !== null) data["min"] = question.min;
    if (question.max !== null) data["max"] = question.max;
  }

  if (question.type === "Select") {
    data["multiple"] = !!question.multiple;
    data["selectOptions"] = question.selectOptions.map((option) => ({
      id: option.id,
      text: option.text,
      isOpen: !!option.isOpen,
    }));
  }

  if (question.type === "Textarea" && question.textAreaRows !== null) {
    data["textAreaRows"] = question.textAreaRows;
  }

  return data;
}

/** Serializes a general form definition into the same JSON shape parseGeneralForm expects. */
export function exportGeneralForm(form: FullGeneralForm) {
  return {
    name: form.name,
    questions: form.questions.map(exportQuestion),
  };
}

/** Serializes a case form definition into the same JSON shape parseCaseForm expects. */
export function exportCaseForm(form: FullCaseForm) {
  return {
    name: form.name,
    type: form.type,
    containsPersonalData: form.containsPersonalData,
    isPersonal: form.isPersonal,
    questions: form.questions.map(exportQuestion),
  };
}
