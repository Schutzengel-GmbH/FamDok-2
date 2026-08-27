import {
  WarningType,
  WarningLevel,
  FormType,
  ANSWER_DEFAULT_INCLUDE,
  QUESTION_DEFAULT_INCLUDE,
  CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
} from "./consts";
import {
  ContactDocumentation,
  Prisma,
  Role,
  Tag,
} from "../shared/generated/prisma/client";
import {
  CASE_DEFAULT_INCLUDE,
  CASE_ANON_INCLUDE,
  CASE_ATTACHMENT_DEFAULT_INCLUDE,
  DOCUMENT_DEFAULT_INCLUDE,
  FAMILY_DEFAULT_INCLUDE,
  ORGANISATION_DEFAULT_INCLUDE,
  SUBORGANISATION_DEFAULT_INCLUDE,
  CASEFORM_DEFAULT_INCLUDE,
  CASEFORMRESPONSE_DEFAULT_INCLUDE,
  GENERALFORM_DEFAULT_INCLUDE,
  GENERALFORMRESPONSE_DEFAULT_INCLUDE,
  USER_DEFAULT_INCLUDE,
} from "./consts";
import z from "zod";
import { SettingsKeys, Settings as SettingsZ } from "./zodTypes";

export interface AuthHandlerConfig {
  overrideAsAdmin?: boolean;
  overrideWithRoles?: Role[];
}

export interface MatchIdAuthHandlerConfig extends AuthHandlerConfig {
  overrideIdParamName?: string;
}

type Handover = {
  caseId: string;
  date: Date;
  removedIds: string[];
  addedIds: string[];
  notes?: string;
};

// Helper types to simplify Prisma types

type FullAnswer = Prisma.AnswerGetPayload<{
  include: typeof ANSWER_DEFAULT_INCLUDE;
}>;

type FullQuestion = Prisma.QuestionGetPayload<{
  include: typeof QUESTION_DEFAULT_INCLUDE;
}>;

type FullCase = Prisma.CaseGetPayload<{
  include: typeof CASE_DEFAULT_INCLUDE;
}>;

type AnonCase = Prisma.CaseGetPayload<{ include: typeof CASE_ANON_INCLUDE }>;

type AnonContactDocumentation = Omit<
  ContactDocumentation,
  "userId" | "answers" | "zusammenfassung" | "dokumentation"
>;

type FullFamily = Prisma.FamilyGetPayload<{
  include: typeof FAMILY_DEFAULT_INCLUDE;
}>;

type FullOrganisation = Prisma.OrganisationGetPayload<{
  include: typeof ORGANISATION_DEFAULT_INCLUDE;
}>;

type FullSubOrganisation = Prisma.SubOrganisationGetPayload<{
  include: typeof SUBORGANISATION_DEFAULT_INCLUDE;
}>;

type FullCaseForm = Prisma.CaseFormGetPayload<{
  include: typeof CASEFORM_DEFAULT_INCLUDE;
}>;

type FullCaseFormResponse = Prisma.CaseFormResponseGetPayload<{
  include: typeof CASEFORMRESPONSE_DEFAULT_INCLUDE;
}>;

type FullGeneralForm = Prisma.GeneralFormGetPayload<{
  include: typeof GENERALFORM_DEFAULT_INCLUDE;
}>;

type FullGeneralFormResponse = Prisma.GeneralFormResponseGetPayload<{
  include: typeof GENERALFORMRESPONSE_DEFAULT_INCLUDE;
}>;

type FullUser = Prisma.UserGetPayload<{ include: typeof USER_DEFAULT_INCLUDE }>;

/** The shape a FullUser is reduced to for Controller/OrgController - every identifying field is
 * stripped, leaving only what's needed to render an "Org1 - SubOrg2" label. */
type AnonUser = Omit<FullUser, "firstName" | "lastName" | "email" | "kcId">;

type FullContactDocumentation = Prisma.ContactDocumentationGetPayload<{
  include: typeof CONTACT_DOCUMENTATION_DEFAULT_INCLUDE;
}>;

type FullDocument = Omit<
  Prisma.DocumentGetPayload<{ include: typeof DOCUMENT_DEFAULT_INCLUDE }>,
  "storageKey"
>;

type FullCaseAttachment = Omit<
  Prisma.CaseAttachmentGetPayload<{
    include: typeof CASE_ATTACHMENT_DEFAULT_INCLUDE;
  }>,
  "storageKey"
>;

type FullTag = Tag;

declare global {
  /** Define the Express interfaces for our application
   */
  namespace Express {
    export interface User extends FullUser {}
  }
}
type Warning =
  | {
      level: WarningLevel;
      type: WarningType.ZV_EXPIRING_SOON | WarningType.ZV_EXPIRED;
      data: { zielvereinbarungsId: string; caseId: string; finishBy: Date };
    }
  | {
      level: WarningLevel;
      type: WarningType.CASE_NO_CONTACT;
      data: { caseId: string; lastContact: Date | null };
    }
  | {
      level: WarningLevel;
      type: WarningType.UNFINISHED_FORM;
      data: {
        formType: FormType;
        responseId: string;
        caseId: string;
        caseFormId?: string;
      };
    }
  | {
      level: WarningLevel;
      type: WarningType.CLOSED_WITHOUT_DOC;
      data: { caseId: string; closedAt: Date };
    }
  | {
      level: WarningLevel;
      type: WarningType.PENDING_PERSONAL_DATA_DELETION;
      data: { caseId: string; personalDataDueAt: Date };
    };

type KeyOfType<T, V> = keyof {
  [P in keyof T as T[P] extends V ? P : never]: any;
};

type SettingsKey = z.infer<typeof SettingsKeys>;

type Settings = z.infer<typeof SettingsZ>;
