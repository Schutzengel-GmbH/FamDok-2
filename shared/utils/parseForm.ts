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

/**
 * Stamps each question with its `order` from its position in the definition array, so the
 * persisted sequence doesn't depend on incidental DB insertion/storage order.
 */
function withOrder(questions: unknown[]): QuestionCreateInput[] {
  return (questions as QuestionCreateInput[]).map((question, order) => ({
    ...question,
    order,
  }));
}

export function parseCaseForm(formInput: string): CaseFormCreateInput {
  const form = JSON.parse(formInput);

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
  const form = JSON.parse(formInput);

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
