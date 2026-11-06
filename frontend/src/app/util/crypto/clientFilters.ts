import type {
  AnswerWhere,
  CaseFormResponseWhere,
  CaseWhere,
  ContactDocumentationWhere,
} from '../../../../../shared/api';

/**
 * The parts of the list filters that touch personal data can't run on the server once that data
 * is encrypted. The services split them off the request and apply them here, to the decrypted
 * results. Only the operators the app's filter UI produces are supported.
 */

type ScalarFilter = Record<string, unknown>;

/** Normalizes values for comparison: dates to timestamps, strings optionally to lower case. */
function norm(value: unknown, insensitive: boolean): unknown {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const asDate = /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
    if (!Number.isNaN(asDate)) return asDate;
    return insensitive ? value.toLowerCase() : value;
  }
  return value;
}

/**
 * Whether `value` satisfies a Prisma-style scalar filter: `equals`, `contains` (with
 * `mode: 'insensitive'`), `gt`/`gte`/`lt`/`lte`, `has` for arrays, or a plain value for equality.
 */
export function matchesScalar(value: unknown, filter: unknown): boolean {
  if (filter === undefined) return true;
  if (filter === null || typeof filter !== 'object' || filter instanceof Date)
    return norm(value, false) === norm(filter, false);

  const f = filter as ScalarFilter;
  const insensitive = f['mode'] === 'insensitive';
  const v = norm(value, insensitive);
  for (const [op, raw] of Object.entries(f)) {
    if (op === 'mode' || raw === undefined) continue;
    const target = norm(raw, insensitive);
    switch (op) {
      case 'equals':
        if (v !== target) return false;
        break;
      case 'contains':
        if (typeof v !== 'string' || !v.includes(String(target))) return false;
        break;
      case 'gt':
        if (v === null || v === undefined || !((v as number) > (target as number))) return false;
        break;
      case 'gte':
        if (v === null || v === undefined || !((v as number) >= (target as number))) return false;
        break;
      case 'lt':
        if (v === null || v === undefined || !((v as number) < (target as number))) return false;
        break;
      case 'lte':
        if (v === null || v === undefined || !((v as number) <= (target as number))) return false;
        break;
      case 'has':
        if (!Array.isArray(value) || !value.includes(raw)) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

/** Splits the family-name filter off a case filter. */
export function splitCaseWhere(where?: CaseWhere): {
  server: CaseWhere | undefined;
  family: CaseWhere['family'];
} {
  if (!where) return { server: where, family: undefined };
  const { family, ...server } = where;
  return { server, family };
}

/** Whether a decrypted case matches a family filter split off by {@link splitCaseWhere}. */
export function matchesFamily(
  c: { family?: { name?: string | null } | null } | null | undefined,
  family: CaseWhere['family'],
): boolean {
  if (!family || family.name === undefined) return true;
  return matchesScalar(c?.family?.name ?? null, family.name);
}

/** Splits the personal-text filters off a contact documentation filter. */
export function splitContactDocumentationWhere(where?: ContactDocumentationWhere) {
  if (!where) return { server: where, client: undefined };
  const { zusammenfassung, dokumentation, case: c, ...server } = where;
  const { server: caseServer, family } = splitCaseWhere(c);
  return {
    server: { ...server, ...(caseServer ? { case: caseServer } : {}) },
    client: { zusammenfassung, dokumentation, family },
  };
}

/** Whether a decrypted contact documentation matches the filters split off above. */
export function matchesContactDocumentation(
  doc: { zusammenfassung?: string | null; dokumentation?: string | null; case?: any },
  client: ReturnType<typeof splitContactDocumentationWhere>['client'],
): boolean {
  if (!client) return true;
  return (
    matchesScalar(doc.zusammenfassung ?? null, client.zusammenfassung) &&
    matchesScalar(doc.dokumentation ?? null, client.dokumentation) &&
    matchesFamily(doc.case, client.family)
  );
}

/** Splits the answer filters and the family filter off a form response filter. */
export function splitResponseWhere(where?: CaseFormResponseWhere) {
  if (!where) return { server: where, client: undefined };
  const { AND, case: c, ...server } = where;
  const { server: caseServer, family } = splitCaseWhere(c);
  return {
    server: { ...server, ...(caseServer ? { case: caseServer } : {}) },
    client: { answers: (AND ?? []).map((a) => a.answers.some), family },
  };
}

/** Whether one decrypted answer satisfies an answer filter. */
function matchesAnswer(answer: Record<string, unknown>, filter: AnswerWhere): boolean {
  return Object.entries(filter).every(([field, f]) =>
    field === 'questionId' ? answer['questionId'] === f : matchesScalar(answer[field], f),
  );
}

/**
 * Whether a decrypted response matches the filters split off above: for every answer filter
 * some answer satisfies it, and the case's family matches.
 */
export function matchesResponse(
  response: { answers?: Record<string, unknown>[]; case?: any },
  client: ReturnType<typeof splitResponseWhere>['client'],
): boolean {
  if (!client) return true;
  return (
    client.answers.every((f) => (response.answers ?? []).some((a) => matchesAnswer(a, f))) &&
    matchesFamily(response.case, client.family)
  );
}
