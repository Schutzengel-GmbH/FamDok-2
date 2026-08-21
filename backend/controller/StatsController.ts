import { prisma } from '../db';
import * as z from 'zod';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from '../util/authUtils';
import {
  canAccessAllStats,
  canAccessScopedStats,
  scopedStatsCaseFilter,
  scopedStatsUserFilter,
} from './authFns/StatsAuthFns';
import {
  CaseWhereInputObjectSchema,
  ContactDocumentationWhereInputObjectSchema,
} from '../../shared/generated/zod/schemas';
import { Prisma } from '../../shared/generated/prisma/client';
import { CASE_ANON_INCLUDE } from '../../shared/consts';
import {
  FullUser,
  AnonCase,
  AnonContactDocumentation,
} from '../../shared/types';
import { CaseWhereInput } from '../../shared/generated/prisma/models';

const AnonCaseWhereInputSchema = CaseWhereInputObjectSchema.refine(
  (o) => {
    const adressLegal =
      o.family?.adress === undefined ||
      //@ts-expect-error I don't know why Prisma Omits the path property here...
      ((o.family.adress.path[0] === 'plz' ||
        //@ts-expect-error I don't know why Prisma Omits the path property here...
        o.family.adress.path[0] === 'city') &&
        //@ts-expect-error I don't know why Prisma Omits the path property here...
        o.family.adress.path.length === 1);
    return (
      // filter the aggregate fields so we don't have to worry about nesting illegal queries
      !o.AND &&
      !o.OR &&
      !o.NOT &&
      !o.caseformResponses &&
      !o.responsibleUsers &&
      !o.createdBy &&
      !o.handovers &&
      !o.userId &&
      !o.family?.additionalPhones &&
      !o.family?.phone &&
      !o.family?.caregiver &&
      !o.family?.children &&
      !o.family?.name &&
      adressLegal
    );
  },
  {
    error:
      'Anonymisierte Statistik erlaubt keine personenbezogenen Familienfilter',
    abort: true,
  }
);

const AnonContactDocumentationWhereInputSchema =
  ContactDocumentationWhereInputObjectSchema.refine(
    (o) => {
      return (
        // filter the aggregate fields so we don't have to worry about nesting illegal queries
        !o.AND &&
        !o.OR &&
        !o.NOT &&
        !o.createdBy &&
        !o.userId &&
        !o.dokumentation &&
        !o.zusammenfassung
      );
    },
    {
      error: 'Anonymisierte Statistik erlaubt keine personenbezogenen Filter',
      abort: true,
    }
  );

/**
 * The mandatory Case scope to force into a query for the given user - `undefined` for
 * Admin/Controller (no restriction), a concrete org/suborg filter for scoped-access roles.
 * Throws if the user has no stats access at all, or a scoped-access role with no org/suborg
 * assigned (a misconfigured user must never fall back to "no filter").
 */
function requireCaseScope(user: FullUser): Prisma.CaseWhereInput | undefined {
  if (canAccessAllStats(user)) return undefined;
  if (!canAccessScopedStats(user)) throw new ForbiddenError();
  const scope = scopedStatsCaseFilter(user);
  if (!scope) throw new ForbiddenError();
  return scope;
}

/** Same as {@link requireCaseScope}, expressed as a User (creator) filter. */
function requireUserScope(user: FullUser): Prisma.UserWhereInput | undefined {
  if (canAccessAllStats(user)) return undefined;
  if (!canAccessScopedStats(user)) throw new ForbiddenError();
  const scope = scopedStatsUserFilter(user);
  if (!scope) throw new ForbiddenError();
  return scope;
}

function validateAnonCaseFilter(filter?: Prisma.CaseWhereInput) {
  try {
    if (filter) AnonCaseWhereInputSchema.parse(filter);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      throw new BadRequestError(e.issues.map((i) => i.message).join(','));
    } else throw new InternalServerError();
  }
}

export class StatsController {
  /**
   * Gets cases in an anonymous form. does not include any family data, nor any
   * nor the specifics on Zielvereinbarungen
   * @param {FullUser} user requesting user
   * @param {Prisma.CaseWhereInput} filter an optional filter to apply
   * @returns {Promise<AnonCase[]>}
   */
  static async getCases(
    user: FullUser,
    filter?: Prisma.CaseWhereInput,
    activeBetween?: { start: Date; end: Date }
  ): Promise<AnonCase[]> {
    validateAnonCaseFilter(filter);
    const scope = requireCaseScope(user);
    return await prisma.case.findMany({
      where: {
        ...filter,
        ...scope,
        OR: activeBetween
          ? [
              { closedAt: null },
              {
                closedAt: { gte: activeBetween.start, lte: activeBetween.end },
              },
            ]
          : [{ closedAt: filter?.closedAt }],
        startedAt: activeBetween
          ? { lte: activeBetween.end }
          : filter?.startedAt,
      },
      include: CASE_ANON_INCLUDE,
    });
  }

  /**
   * Count the number of cases satisfying a given filter
   * @param {FullUser} user requesting user
   * @param {Prisma.CaseWhereInput} filter filter to use, any family filter will be discarded
   * @returns {Promise<number>}
   */
  static async countCases(
    user: FullUser,
    filter: Prisma.CaseWhereInput,
    activeBetween?: { start: Date; end: Date }
  ): Promise<number> {
    validateAnonCaseFilter(filter);
    const scope = requireCaseScope(user);
    return await prisma.case.count({
      where: {
        ...filter,
        ...scope,
        OR: activeBetween
          ? [
              { closedAt: null },
              {
                closedAt: { gte: activeBetween.start, lte: activeBetween.end },
              },
            ]
          : [{ closedAt: filter?.closedAt }],
        startedAt: activeBetween
          ? { lte: activeBetween.end }
          : filter?.startedAt,
      },
    });
  }

  /**
   * Count the number of geneal form responses satisfieing a given filter
   * @param {FullUser} user requesting user
   * @param {Prisma.GeneralFormResponseWhereInput} filter filter to use
   * @returns {Promise<number>}
   */
  static async countGeneralFormResponses(
    user: FullUser,
    filter: Prisma.GeneralFormResponseWhereInput
  ): Promise<number> {
    const scope = requireUserScope(user);
    return await prisma.generalFormResponse.count({
      where: { ...filter, ...(scope && { createdBy: scope }) },
    });
  }

  /**
   * Get the anonymised ContactDocs matching a case and/or contactDocumentation filter.
   * @param {FullUser} user requesting User
   * @param {Prisma.CaseWhereInput} caseFilter Case filter
   * @param {Prisma.ContactDocumentationWhereInput} contactDocumentationFilter ContactDocumentation filter
   * @returns {Promise<AnonContactDocumentation[]>}
   */
  static async contactDocumentation(
    user: FullUser,
    caseFilter: Prisma.CaseWhereInput,
    contactDocumentationFilter: Prisma.ContactDocumentationWhereInput
  ): Promise<AnonContactDocumentation[]> {
    AnonCaseWhereInputSchema.parse(caseFilter);
    AnonContactDocumentationWhereInputSchema.parse(contactDocumentationFilter);

    const scope = requireCaseScope(user);

    const docs = await prisma.contactDocumentation.findMany({
      where: {
        ...contactDocumentationFilter,
        case: { ...caseFilter, ...scope },
      },
    });

    return docs.map<AnonContactDocumentation>((doc) => {
      return {
        id: doc.id,
        date: doc.date,
        caseId: doc.caseId,
        artDerBetreuung: doc.artDerBetreuung,
        beratungsThemenAllgemein: doc.beratungsThemenAllgemein,
        beratungsThemenEltern: doc.beratungsThemenEltern,
        beratungsThemenKinder: doc.beratungsThemenKinder,
        duration: doc.duration,
      };
    });
  }

  /**
   * Count the number of contactDocumentations satisfying a given filter
   * @param {FullUser} user requesting user
   * @param {Prisma.ContactDocumentationWhereInput} filter filter to use
   * @returns {Promise<number>}
   */
  static async countContactDocumentation(
    user: FullUser,
    filter: Prisma.ContactDocumentationWhereInput
  ): Promise<number> {
    const scope = requireCaseScope(user);
    return await prisma.contactDocumentation.count({
      where: {
        ...filter,
        ...(scope && {
          case: { ...(filter.case as Prisma.CaseWhereInput), ...scope },
        }),
      },
    });
  }

  /**
   * Count the number of caseFormResponses satisfying a given filter
   * @param {FullUser} user requesting user
   * @param {Prisma.CaseFormResponseWhereInput} filter filter to use
   * @returns {Promise<number>}
   */
  static async countCaseFormResponses(
    id: string,
    user: FullUser,
    filter: Prisma.CaseFormResponseWhereInput
  ): Promise<number> {
    const scope = requireCaseScope(user);

    const form = await prisma.caseForm.findUniqueOrThrow({
      where: { id },
    });
    if (form.containsPersonalData)
      throw new ForbiddenError(
        'Keine Statistiken für personenbezogene Formulare'
      );

    return await prisma.caseFormResponse.count({
      where: {
        ...filter,
        caseFormId: id,
        ...(scope && {
          case: { ...(filter.case as Prisma.CaseWhereInput), ...scope },
        }),
      },
    });
  }

  /**
   * Get an array of all unique cities in the dataset of families' addresses.
   * @returns {Promise<string[]>}
   */
  static async getCities(user: FullUser): Promise<string[]> {
    if (canAccessAllStats(user)) {
      const result: { city: string }[] =
        await prisma.$queryRaw`SELECT adress->>'city' AS city FROM (SELECT DISTINCT ON (adress->'city') adress FROM "Family") AS query`;
      return result.map((c) => c.city);
    }

    if (!canAccessScopedStats(user) || !user.organisationId)
      throw new ForbiddenError();

    // City list is org-scoped (not suborg-scoped) for every scoped-access role - it's just a
    // set of city names for a filter dropdown, not case-level data.
    const result: { city: string }[] = await prisma.$queryRaw`
      SELECT adress->>'city' AS city FROM (
        SELECT DISTINCT ON (adress->'city') adress FROM "Family" WHERE "organisationId" = ${user.organisationId}
      ) AS query`;
    return result.map((c) => c.city);
  }
}
