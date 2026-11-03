import { prisma } from '../db';
import { ForbiddenError } from '../util/authUtils';
import {
  canAccessAllStats,
  canAccessScopedStats,
  scopedStatsCaseFilter,
  scopedStatsUserFilter,
} from './authFns/StatsAuthFns';
import { Prisma } from '../../shared/generated/prisma/client';
import {
  AnonCaseWhere,
  StatsCaseQuery,
  StatsContactDocumentationQuery,
} from '../../shared/api';
import { CASE_ANON_INCLUDE } from '../../shared/consts';
import {
  FullUser,
  AnonCase,
  AnonContactDocumentation,
} from '../../shared/types';

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
    filter?: AnonCaseWhere,
    activeBetween?: StatsCaseQuery['activeBetween']
  ): Promise<AnonCase[]> {
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
    filter?: AnonCaseWhere,
    activeBetween?: StatsCaseQuery['activeBetween']
  ): Promise<number> {
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
   * Get the anonymised ContactDocs matching a case and/or contactDocumentation filter.
   * @param {FullUser} user requesting User
   * @param {Prisma.CaseWhereInput} caseFilter Case filter
   * @param {Prisma.ContactDocumentationWhereInput} contactDocumentationFilter ContactDocumentation filter
   * @returns {Promise<AnonContactDocumentation[]>}
   */
  static async contactDocumentation(
    user: FullUser,
    caseFilter?: StatsContactDocumentationQuery['caseFilter'],
    contactDocumentationFilter?: StatsContactDocumentationQuery['docFilter']
  ): Promise<AnonContactDocumentation[]> {
    const scope = requireCaseScope(user);

    const docs = await prisma.contactDocumentation.findMany({
      where: {
        ...contactDocumentationFilter,
        case: { AND: [caseFilter ?? {}, scope ?? {}] },
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
