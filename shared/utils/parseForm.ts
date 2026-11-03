import { Question } from "../generated/prisma/browser";
import { FullCaseForm, FullGeneralForm } from "../types";
import {
  CaseFormCreateRequest,
  GeneralFormCreateRequest,
  QuestionCreate,
} from "../api/form";
import z from "zod";

/**
 * Parses an uploaded definition and checks its outer shape, so malformed input surfaces as a
 * ZodError rather than a raw SyntaxError/TypeError. The fields themselves are validated by
 * the request schemas below.
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
function withOrder(questions: Record<string, unknown>[]) {
  return questions.map((question, order) => ({
    ...question,
    order,
  })) as QuestionCreate[];
}

export function parseCaseForm(formInput: string): CaseFormCreateRequest {
  const form = FormDefinitionSchema.parse(formInput);

  return CaseFormCreateRequest.parse({
    ...form,
    questions: withOrder(form.questions),
  });
}

export function parseGeneralForm(formInput: string): GeneralFormCreateRequest {
  const form = FormDefinitionSchema.parse(formInput);

  return GeneralFormCreateRequest.parse({
    ...form,
    questions: withOrder(form.questions),
  });
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
