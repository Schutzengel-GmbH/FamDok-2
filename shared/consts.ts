import {
  AnswerInclude,
  CaseAttachmentInclude,
  CaseFormInclude,
  CaseFormResponseInclude,
  CaseInclude,
  ContactDocumentationInclude,
  DocumentInclude,
  FamilyInclude,
  GeneralFormInclude,
  GeneralFormResponseInclude,
  OrganisationInclude,
  QuestionInclude,
  SubOrganisationInclude,
  UserInclude,
} from "./generated/prisma/models";

export const QUESTION_DEFAULT_INCLUDE = {} satisfies QuestionInclude;

export const ANSWER_DEFAULT_INCLUDE = {
  question: true,
} satisfies AnswerInclude;

export const ORGANISATION_DEFAULT_INCLUDE = {
  subOrganisations: true,
} satisfies OrganisationInclude;

export const SUBORGANISATION_DEFAULT_INCLUDE =
  {} satisfies SubOrganisationInclude;

export const USER_DEFAULT_INCLUDE = {
  organisation: { include: ORGANISATION_DEFAULT_INCLUDE },
  subOrganisations: { include: SUBORGANISATION_DEFAULT_INCLUDE },
} satisfies UserInclude;

export const GENERALFORM_DEFAULT_INCLUDE = {
  questions: {
    include: QUESTION_DEFAULT_INCLUDE,
    orderBy: { order: "asc" },
  },
} satisfies GeneralFormInclude;

export const GENERALFORMRESPONSE_DEFAULT_INCLUDE = {
  createdBy: { include: USER_DEFAULT_INCLUDE },
  answers: { include: ANSWER_DEFAULT_INCLUDE },
} satisfies GeneralFormResponseInclude;

export const CASEFORM_DEFAULT_INCLUDE = {
  questions: { orderBy: { order: "asc" } },
} satisfies CaseFormInclude;

export const FAMILY_DEFAULT_INCLUDE = {
  caregiver: true,
  children: true,
  case: {
    include: {
      zielvereinbarungen: true,
      responsibleUsers: { include: USER_DEFAULT_INCLUDE },
    },
  },
} satisfies FamilyInclude;

export const CASE_ATTACHMENT_DEFAULT_INCLUDE = {
  uploadedBy: { include: USER_DEFAULT_INCLUDE },
} satisfies CaseAttachmentInclude;

export const DOCUMENT_DEFAULT_INCLUDE = {
  tags: true,
  uploadedBy: { include: USER_DEFAULT_INCLUDE },
} satisfies DocumentInclude;

export const CASE_DEFAULT_INCLUDE = {
  responsibleUsers: { include: USER_DEFAULT_INCLUDE },
  zielvereinbarungen: {
    include: { createdBy: { include: USER_DEFAULT_INCLUDE } },
  },
  family: { include: FAMILY_DEFAULT_INCLUDE },
  contactDocumentation: {
    include: { createdBy: { include: USER_DEFAULT_INCLUDE } },
  },
  createdBy: { include: USER_DEFAULT_INCLUDE },
  attachments: {
    include: CASE_ATTACHMENT_DEFAULT_INCLUDE,
    omit: { storageKey: true },
  },
} satisfies CaseInclude;

export const CASE_ANON_INCLUDE = {
  zielvereinbarungen: {
    omit: { description: true },
  },
  family: { select: { organisationId: true, id: true } },
  contactDocumentation: {
    omit: { zusammenfassung: true, dokumentation: true },
  },
  caseformResponses: false,
  createdBy: false,
  responsibleUsers: false,
  handovers: false,
  attachments: false,
} satisfies CaseInclude;

export const CASEFORMRESPONSE_DEFAULT_INCLUDE = {
  createdBy: { include: USER_DEFAULT_INCLUDE },
  child: true,
  caregiver: true,
  case: { include: CASE_DEFAULT_INCLUDE },
  answers: { include: ANSWER_DEFAULT_INCLUDE },
  caseForm: true,
} satisfies CaseFormResponseInclude;

export const CONTACT_DOCUMENTATION_DEFAULT_INCLUDE = {
  createdBy: { include: USER_DEFAULT_INCLUDE },
  case: { include: CASE_DEFAULT_INCLUDE },
} satisfies ContactDocumentationInclude;

export enum WarningLevel {
  INFO = 0,
  WARNING,
}

export enum WarningType {
  ZV_EXPIRING_SOON = 0,
  CASE_NO_CONTACT,
  UNFINISHED_FORM,
  UNFINISHED_CLOSE,
  CLOSED_WITHOUT_DOC,
  ZV_EXPIRED,
}

export enum FormType {
  CONTACT_DOC = 0,
  CASE_FORM,
  GENERAL_FORM,
  CLOSING_DOC,
}

/**
 * WHO percentiles for boys and girls aged 0-3 years
 */

/**
 * WHO 97th percentile weight boys
 */
export const P_97_BOYS = [
  4.3, 5.7, 7, 7.9, 8.6, 9.2, 9.7, 10.2, 10.5, 10.9, 11.2, 11.5, 11.8, 12.1,
  12.4, 12.7, 12.9, 13.2, 13.5, 13.7, 14, 14.3, 14.5, 14.8, 15.1, 15.3, 15.6,
  15.9, 16.1, 16.4, 16.6, 16.9, 17.1, 17.3, 17.6, 17.8,
];
/**
 * WHO 85th percentile weight boys
 */
export const P_85_BOYS = [
  3.9, 5.1, 6.3, 7.2, 7.9, 8.4, 8.9, 9.3, 9.6, 10, 10.3, 10.5, 10.8, 11.1, 11.3,
  11.6, 11.8, 12, 12.3, 12.5, 12.7, 13, 13.2, 13.4, 13.7, 13.9, 14.1, 14.4,
  14.6, 14.8, 15, 15.2, 15.5, 15.7, 15.9, 16.1,
];
/**
 * WHO 50th percentile weight boys
 */
export const P_50_BOYS = [
  3.3, 4.5, 5.6, 6.4, 7, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6, 9.9, 10.1,
  10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.8, 12, 12.2, 12.4, 12.5, 12.7,
  12.9, 13.1, 13.3, 13.5, 13.7, 13.8, 14, 14.2,
];
/**
 * WHO 15th percentile weight boys
 */
export const P_15_BOYS = [
  2.9, 3.9, 4.9, 5.6, 6.2, 6.7, 7.1, 7.4, 7.7, 7.9, 8.2, 8.4, 8.6, 8.8, 9, 9.2,
  9.4, 9.6, 9.7, 9.9, 10.1, 10.3, 10.5, 10.6, 10.8, 11, 11.1, 11.3, 11.5, 11.6,
  11.8, 11.9, 12.1, 12.2, 12.4, 12.5,
];
/**
 * WHO 3rd percentile weight boys
 */
export const P_03_BOYS = [
  2.5, 3.4, 4.4, 5.1, 5.6, 6.1, 6.4, 6.7, 7, 7.2, 7.5, 7.7, 7.8, 8, 8.2, 8.4,
  8.5, 8.7, 8.9, 9, 9.2, 9.3, 9.5, 9.7, 9.8, 10, 10.1, 10.2, 10.4, 10.5, 10.7,
  10.8, 10.9, 11.1, 11.2, 11.3,
];

/**
 * WHO 97th percentile weight girls
 */
export const P_97_GIRLS = [
  4.2, 5.4, 6.5, 7.4, 8.1, 8.7, 9.2, 9.6, 10, 10.4, 10.7, 11, 11.3, 11.6, 11.9,
  12.2, 12.5, 12.7, 13, 13.3, 13.5, 13.8, 14.1, 14.3, 14.6, 14.9, 15.2, 15.4,
  15.7, 16, 16.2, 16.5, 16.8, 17, 17.3, 17.6,
];
/**
 * WHO 85th percentile weight girls
 */
export const P_85_GIRLS = [
  3.7, 4.8, 5.9, 6.7, 7.3, 7.8, 8.3, 8.7, 9, 9.3, 9.6, 9.9, 10.2, 10.4, 10.7,
  10.9, 11.2, 11.4, 11.6, 11.9, 12.1, 12.4, 12.6, 12.8, 13.1, 13.3, 13.6, 13.8,
  14, 14.3, 14.5, 14.7, 15, 15.2, 15.4, 15.7,
];
/**
 * WHO 50th percentile weight girls
 */
export const P_50_GIRLS = [
  3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9, 9.2, 9.4,
  9.6, 9.8, 10, 10.2, 10.4, 10.6, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1,
  12.3, 12.5, 12.7, 12.9, 13.1, 13.3, 13.5, 13.7,
];
/**
 * WHO 15th percentile weight girls
 */
export const P_15_GIRLS = [
  2.8, 3.6, 4.5, 5.1, 5.6, 6.1, 6.4, 6.7, 7, 7.3, 7.5, 7.7, 7.9, 8.1, 8.3, 8.5,
  8.7, 8.8, 9, 9.2, 9.4, 9.6, 9.8, 9.9, 10.1, 10.3, 10.5, 10.7, 10.8, 11, 11.2,
  11.3, 11.5, 11.7, 11.8, 12,
];
/**
 * WHO 3rd percentile weight girls
 */
export const P_03_GIRLS = [
  2.4, 3.2, 4, 4.6, 5.1, 5.5, 5.8, 6.1, 6.3, 6.6, 6.8, 7, 7.1, 7.3, 7.5, 7.7,
  7.8, 8, 8.2, 8.3, 8.5, 8.7, 8.8, 9, 9.2, 9.3, 9.5, 9.6, 9.8, 10, 10.1, 10.3,
  10.4, 10.5, 10.7, 10.8,
];
