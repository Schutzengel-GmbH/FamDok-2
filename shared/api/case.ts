import * as z from "zod";
import { CaseCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseCreateManyInput.schema";
import { CaseScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseScalarWhereInput.schema";
import { ContactDocumentationCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/ContactDocumentationCreateManyInput.schema";
import { ContactDocumentationScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/ContactDocumentationScalarWhereInput.schema";
import { FamilyScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/FamilyScalarWhereInput.schema";
import { ZielvereinbarungCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/ZielvereinbarungCreateManyInput.schema";
import { ZielvereinbarungScalarWhereInputObjectZodSchema } from "../generated/zod/schemas/objects/ZielvereinbarungScalarWhereInput.schema";
import { Wire } from "./common";
import { FamilyCreateRequest } from "./family";
import { CreatedByWhere } from "./user";

const ZielFields = ZielvereinbarungCreateManyInputObjectZodSchema.pick({
  startedAt: true,
  finishBy: true,
  status: true,
  topic: true,
  description: true,
});

/** Body of `POST /case/i/:id/ziel` */
export const ZielCreateRequest = ZielFields.strict();
export type ZielCreateRequest = Wire<typeof ZielCreateRequest>;

/** Body of `PUT /case/i/:id/ziel/:ziel` */
export const ZielUpdateRequest = ZielFields.partial().strict();
export type ZielUpdateRequest = Wire<typeof ZielUpdateRequest>;

const ContactDocumentationFields =
  ContactDocumentationCreateManyInputObjectZodSchema.pick({
    date: true,
    duration: true,
    start: true,
    end: true,
    artDerBetreuung: true,
    zusammenfassung: true,
    dokumentation: true,
  }).extend({
    beratungsThemenEltern: z.array(z.number().int()).optional(),
    beratungsThemenKinder: z.array(z.number().int()).optional(),
    beratungsThemenAllgemein: z.array(z.number().int()).optional(),
  });

/** Body of `POST /case/i/:id/documentation`. Empty for the draft of a new documentation. */
export const ContactDocumentationCreateRequest =
  ContactDocumentationFields.strict();
export type ContactDocumentationCreateRequest = Wire<
  typeof ContactDocumentationCreateRequest
>;

/** Body of `PUT /case/i/:id/documentation/i/:docId` */
export const ContactDocumentationUpdateRequest =
  ContactDocumentationFields.strict();
export type ContactDocumentationUpdateRequest = Wire<
  typeof ContactDocumentationUpdateRequest
>;

/** Body of `POST /case`: a new case along with its family, in the user's own organisation. */
export const CaseCreateRequest = CaseCreateManyInputObjectZodSchema.pick({
  startedAt: true,
  migrationBackground: true,
  specificMigrationBackground: true,
  familienstand: true,
  partnerInvolved: true,
  bekanntJA: true,
})
  .extend({ family: FamilyCreateRequest })
  .strict();
export type CaseCreateRequest = Wire<typeof CaseCreateRequest>;

/**
 * What cases can be filtered by. Controllers always apply this on top of what the user may see,
 * and drop `family` for anonymized roles.
 */
export const CaseWhere = CaseScalarWhereInputObjectZodSchema.pick({
  closedAt: true,
  startedAt: true,
  city: true,
  plz: true,
  organisationId: true,
  subOrganisationId: true,
})
  .extend({
    family: FamilyScalarWhereInputObjectZodSchema.pick({ name: true })
      .strict()
      .optional(),
    zielvereinbarungen: z
      .strictObject({
        some: ZielvereinbarungScalarWhereInputObjectZodSchema.pick({
          startedAt: true,
          finishBy: true,
          status: true,
          topic: true,
        }).strict(),
      })
      .optional(),
    contactDocumentation: z
      .strictObject({
        some: ContactDocumentationScalarWhereInputObjectZodSchema.pick({
          date: true,
        }).strict(),
      })
      .optional(),
  })
  .strict();
export type CaseWhere = Wire<typeof CaseWhere>;

/** Query of `GET /case` */
export const CaseListQuery = z.strictObject({ where: CaseWhere.optional() });
export type CaseListQuery = Wire<typeof CaseListQuery>;

export const MY_CASES_SCOPES = ["own", "org", "subOrg"] as const;

/** Query of `GET /case/my`. The `latestContact` preset only loads the latest documentation. */
export const MyCasesQuery = z.strictObject({
  where: CaseWhere.optional(),
  scope: z.enum(MY_CASES_SCOPES).optional(),
  preset: z.literal("latestContact").optional(),
});
export type MyCasesQuery = Wire<typeof MyCasesQuery>;

/** What contact documentation can be filtered by, see {@link CaseWhere}. */
export const ContactDocumentationWhere =
  ContactDocumentationScalarWhereInputObjectZodSchema.pick({
    date: true,
    duration: true,
    artDerBetreuung: true,
    beratungsThemenEltern: true,
    beratungsThemenKinder: true,
    beratungsThemenAllgemein: true,
    zusammenfassung: true,
    dokumentation: true,
  })
    .extend({
      case: CaseWhere.optional(),
      createdBy: CreatedByWhere.optional(),
    })
    .strict();
export type ContactDocumentationWhere = Wire<typeof ContactDocumentationWhere>;

/** Query of the `/documentation` lists */
export const ContactDocumentationListQuery = z.strictObject({
  where: ContactDocumentationWhere.optional(),
});
export type ContactDocumentationListQuery = Wire<
  typeof ContactDocumentationListQuery
>;

/** Query of the routes that return the latest few entries */
export const LatestQuery = z.strictObject({
  n: z.number().int().positive().optional(),
});
export type LatestQuery = Wire<typeof LatestQuery>;

/** Body of `POST /case/handover` */
export const HandoverRequest = z.strictObject({
  caseId: z.string(),
  date: z.coerce.date(),
  removedIds: z.array(z.string()),
  addedIds: z.array(z.string()),
  notes: z.string().nullish(),
});
export type HandoverRequest = Wire<typeof HandoverRequest>;

/** Body of `POST /case/close/:caseId` */
export const CaseCloseRequest = z.strictObject({ date: z.coerce.date() });
export type CaseCloseRequest = Wire<typeof CaseCloseRequest>;

/** Body of `POST /case/i/:id/attachment`, next to the file */
export const CaseAttachmentRequest = z.strictObject({
  note: z.string().optional(),
});
export type CaseAttachmentRequest = Wire<typeof CaseAttachmentRequest>;
