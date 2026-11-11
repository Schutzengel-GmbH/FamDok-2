import * as z from "zod";
import { CaregiverCreateManyFamilyInputObjectZodSchema } from "../generated/zod/schemas/objects/CaregiverCreateManyFamilyInput.schema";
import { CaseCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/CaseCreateManyInput.schema";
import { ChildCreateManyFamilyInputObjectZodSchema } from "../generated/zod/schemas/objects/ChildCreateManyFamilyInput.schema";
import { FamilyCreateManyInputObjectZodSchema } from "../generated/zod/schemas/objects/FamilyCreateManyInput.schema";
import { Wire } from "./common";

/** See {@link ClientId} in case.ts. */
const ClientId = z.uuid();
/** v1. envelope of all personal fields of the row, in encrypted orgs. */
const EncryptedBlob = z.string().nullish();

const Address = z.strictObject({
  street: z.string().nullish(),
  number: z.string().nullish(),
  plz: z.string().nullish(),
  city: z.string().nullish(),
});

const HealthDataPoint = z.strictObject({
  date: z.coerce.date(),
  weightKg: z.number().nullish(),
  sizeCm: z.number().nullish(),
});

const ChildFields = ChildCreateManyFamilyInputObjectZodSchema.pick({
  name: true,
  lastName: true,
  gender: true,
  dateOfBirth: true,
}).extend({
  healthData: z.array(HealthDataPoint).optional(),
  encrypted: EncryptedBlob,
});

const CaregiverFields = CaregiverCreateManyFamilyInputObjectZodSchema.pick({
  name: true,
  lastName: true,
  relation: true,
  gender: true,
  dateOfBirth: true,
}).extend({ encrypted: EncryptedBlob });

const FamilyFields = FamilyCreateManyInputObjectZodSchema.pick({
  name: true,
  note: true,
  phone: true,
}).extend({
  adress: Address.optional(),
  additionalPhones: z.array(z.string()).optional(),
  encrypted: EncryptedBlob,
});

/** The family created along with a case */
export const FamilyCreateRequest = FamilyFields.extend({
  id: ClientId.optional(),
  children: z.array(ChildFields.extend({ id: ClientId.optional() }).strict()).optional(),
  caregivers: z
    .array(CaregiverFields.extend({ id: ClientId.optional() }).strict())
    .optional(),
}).strict();
export type FamilyCreateRequest = Wire<typeof FamilyCreateRequest>;

/** The case fields that are edited together with the family */
export const FamilyCaseFields = CaseCreateManyInputObjectZodSchema.pick({
  migrationBackground: true,
  specificMigrationBackground: true,
  familienstand: true,
  partnerInvolved: true,
  bekanntJA: true,
  city: true,
  plz: true,
}).partial();

/**
 * Body of `PUT /family/i/:id`. `children` and `caregivers` replace the existing ones, keeping
 * the ids of those that stay, as form responses refer to them.
 */
export const FamilyUpdateRequest = FamilyFields.partial()
  .extend({
    children: z
      .array(ChildFields.extend({ id: z.string().optional() }).strict())
      .optional(),
    caregivers: z
      .array(CaregiverFields.extend({ id: z.string().optional() }).strict())
      .optional(),
    case: FamilyCaseFields.strict().optional(),
  })
  .strict();
export type FamilyUpdateRequest = Wire<typeof FamilyUpdateRequest>;
export type ChildRequest = NonNullable<FamilyUpdateRequest["children"]>[number];
export type CaregiverRequest = NonNullable<
  FamilyUpdateRequest["caregivers"]
>[number];

/**
 * Body of `PUT /family/i/:id/children/:childId/health-data`. In encrypted orgs the health data
 * lives in the child's blob, so the whole re-encrypted blob is sent instead.
 */
export const ChildHealthDataRequest = z.strictObject({
  healthData: z.array(HealthDataPoint).optional(),
  encrypted: EncryptedBlob,
});
export type ChildHealthDataRequest = Wire<typeof ChildHealthDataRequest>;
