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
    omit: { description: true, userId: true },
  },
  family: { select: { organisationId: true, id: true } },
  contactDocumentation: {
    omit: { zusammenfassung: true, dokumentation: true, userId: true },
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
  PENDING_PERSONAL_DATA_DELETION,
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

/**
 * WHO length/height-for-age percentiles for boys and girls aged 0-3 years
 * (36 monthly values each, same shape as the weight percentile arrays above).
 * Months 0-23 use the WHO length-for-age (recumbent, 0-2y) tables; months
 * 24-35 use the WHO height-for-age (standing, 2-5y) tables, matching WHO's
 * own switch in measurement method at 24 months (standing height reads
 * ~0.7cm lower than recumbent length at the same age, hence the small step
 * at index 24 below — this is expected, not a data error).
 */

/** WHO 97th percentile length/height-for-age boys */
export const P_97_HEIGHT_BOYS = [
  53.4, 58.4, 62.2, 65.3, 67.8, 69.9, 71.6, 73.2, 74.7, 76.2,
  77.6, 78.9, 80.2, 81.5, 82.7, 83.9, 85.1, 86.2, 87.3, 88.4,
  89.5, 90.5, 91.6, 92.6, 92.9, 93.8, 94.8, 95.7, 96.6, 97.5,
  98.3, 99.2, 100.0, 100.8, 101.5, 102.3,
];
/** WHO 85th percentile length/height-for-age boys */
export const P_85_HEIGHT_BOYS = [
  51.8, 56.7, 60.5, 63.5, 66.0, 68.1, 69.8, 71.4, 72.9, 74.3,
  75.6, 77.0, 78.2, 79.4, 80.6, 81.8, 82.9, 84.0, 85.1, 86.1,
  87.1, 88.1, 89.1, 90.0, 90.3, 91.2, 92.1, 93.0, 93.8, 94.7,
  95.5, 96.2, 97.0, 97.8, 98.5, 99.2,
];
/** WHO 50th percentile length/height-for-age boys */
export const P_50_HEIGHT_BOYS = [
  49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0,
  73.3, 74.5, 75.7, 76.9, 78.0, 79.1, 80.2, 81.2, 82.3, 83.2,
  84.2, 85.1, 86.0, 86.9, 87.1, 88.0, 88.8, 89.6, 90.4, 91.2,
  91.9, 92.7, 93.4, 94.1, 94.8, 95.4,
];
/** WHO 15th percentile length/height-for-age boys */
export const P_15_HEIGHT_BOYS = [
  47.9, 52.7, 56.4, 59.3, 61.7, 63.7, 65.4, 66.9, 68.3, 69.6,
  70.9, 72.1, 73.3, 74.4, 75.5, 76.5, 77.5, 78.5, 79.5, 80.4,
  81.3, 82.2, 83.0, 83.8, 83.9, 84.7, 85.5, 86.3, 87.0, 87.7,
  88.4, 89.1, 89.7, 90.4, 91.0, 91.6,
];
/** WHO 3rd percentile length/height-for-age boys */
export const P_03_HEIGHT_BOYS = [
  46.3, 51.1, 54.7, 57.6, 60.0, 61.9, 63.6, 65.1, 66.5, 67.7,
  69.0, 70.2, 71.3, 72.4, 73.4, 74.4, 75.4, 76.3, 77.2, 78.1,
  78.9, 79.7, 80.5, 81.3, 81.4, 82.1, 82.8, 83.5, 84.2, 84.9,
  85.5, 86.2, 86.8, 87.4, 88.0, 88.5,
];

/** WHO 97th percentile length/height-for-age girls */
export const P_97_HEIGHT_GIRLS = [
  52.7, 57.4, 60.9, 63.8, 66.2, 68.2, 70.0, 71.6, 73.2, 74.7,
  76.1, 77.5, 78.9, 80.2, 81.4, 82.7, 83.9, 85.0, 86.2, 87.3,
  88.4, 89.4, 90.5, 91.5, 91.8, 92.8, 93.7, 94.6, 95.6, 96.4,
  97.3, 98.2, 99.0, 99.8, 100.6, 101.4,
];
/** WHO 85th percentile length/height-for-age girls */
export const P_85_HEIGHT_GIRLS = [
  51.1, 55.7, 59.2, 62.0, 64.3, 66.3, 68.1, 69.7, 71.2, 72.6,
  74.0, 75.4, 76.7, 77.9, 79.2, 80.3, 81.5, 82.6, 83.7, 84.8,
  85.8, 86.8, 87.8, 88.8, 89.1, 90.0, 90.9, 91.8, 92.7, 93.5,
  94.3, 95.2, 95.9, 96.7, 97.5, 98.3,
];
/** WHO 50th percentile length/height-for-age girls */
export const P_50_HEIGHT_GIRLS = [
  49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1,
  71.5, 72.8, 74.0, 75.2, 76.4, 77.5, 78.6, 79.7, 80.7, 81.7,
  82.7, 83.7, 84.6, 85.5, 85.7, 86.6, 87.4, 88.3, 89.1, 89.9,
  90.7, 91.4, 92.2, 92.9, 93.6, 94.4,
];
/** WHO 15th percentile length/height-for-age girls */
export const P_15_HEIGHT_GIRLS = [
  47.2, 51.7, 55.0, 57.6, 59.8, 61.7, 63.4, 64.9, 66.3, 67.6,
  68.9, 70.2, 71.3, 72.5, 73.6, 74.7, 75.7, 76.7, 77.7, 78.7,
  79.6, 80.5, 81.4, 82.2, 82.4, 83.2, 84.0, 84.8, 85.5, 86.3,
  87.0, 87.7, 88.4, 89.1, 89.8, 90.5,
];
/** WHO 3rd percentile length/height-for-age girls */
export const P_03_HEIGHT_GIRLS = [
  45.6, 50.0, 53.2, 55.8, 58.0, 59.9, 61.5, 62.9, 64.3, 65.6,
  66.8, 68.0, 69.2, 70.3, 71.3, 72.4, 73.3, 74.3, 75.2, 76.2,
  77.0, 77.9, 78.7, 79.6, 79.6, 80.4, 81.2, 81.9, 82.6, 83.4,
  84.0, 84.7, 85.4, 86.0, 86.7, 87.3,
];
