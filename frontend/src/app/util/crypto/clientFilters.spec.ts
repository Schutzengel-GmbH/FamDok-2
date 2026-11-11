import {
  matchesContactDocumentation,
  matchesFamily,
  matchesResponse,
  matchesScalar,
  splitCaseWhere,
  splitContactDocumentationWhere,
  splitResponseWhere,
} from './clientFilters';

describe('clientFilters', () => {
  it('evaluates the scalar operators the filter UI produces', () => {
    expect(matchesScalar('Familie Muster', { contains: 'muster', mode: 'insensitive' })).toBeTrue();
    expect(matchesScalar('Familie Muster', { contains: 'muster' })).toBeFalse();
    expect(matchesScalar('Muster', { equals: 'Muster' })).toBeTrue();
    expect(matchesScalar(5, { gt: 3, lte: 5 })).toBeTrue();
    expect(matchesScalar(null, { gt: 3 })).toBeFalse();
    expect(matchesScalar(new Date('2026-01-02'), { gte: '2026-01-01T00:00:00.000Z' })).toBeTrue();
    expect(matchesScalar([1, 4], { has: 4 })).toBeTrue();
    expect(matchesScalar([1, 4], { has: 2 })).toBeFalse();
    expect(matchesScalar('x', undefined)).toBeTrue();
  });

  it('splits the family name off case filters and applies it to decrypted cases', () => {
    const { server, family } = splitCaseWhere({ city: { equals: 'Kiel' }, family: { name: { contains: 'mus', mode: 'insensitive' } } } as any);
    expect(server).toEqual({ city: { equals: 'Kiel' } } as any);
    expect(matchesFamily({ family: { name: 'Muster' } }, family)).toBeTrue();
    expect(matchesFamily({ family: { name: 'Beispiel' } }, family)).toBeFalse();
    expect(matchesFamily({ family: null }, undefined)).toBeTrue();
  });

  it('splits and applies contact documentation text filters', () => {
    const { server, client } = splitContactDocumentationWhere({
      duration: { gte: 30 },
      zusammenfassung: { contains: 'hausbesuch', mode: 'insensitive' },
    } as any);
    expect(server).toEqual({ duration: { gte: 30 } } as any);
    expect(matchesContactDocumentation({ zusammenfassung: 'Hausbesuch am Morgen' }, client)).toBeTrue();
    expect(matchesContactDocumentation({ zusammenfassung: 'Telefonat' }, client)).toBeFalse();
  });

  it('applies every answer filter to the decrypted answers of a response', () => {
    const { server, client } = splitResponseWhere({
      caseFormId: 'f',
      AND: [
        { answers: { some: { questionId: 'q1', answerText: { contains: 'ja', mode: 'insensitive' } } } },
        { answers: { some: { questionId: 'q2', answerInt: { gte: 2 } } } },
      ],
    } as any);
    expect(server).toEqual({ caseFormId: 'f' } as any);
    const answers = [
      { questionId: 'q1', answerText: 'Ja, gern' },
      { questionId: 'q2', answerInt: 3 },
    ];
    expect(matchesResponse({ answers }, client)).toBeTrue();
    expect(matchesResponse({ answers: [answers[0], { questionId: 'q2', answerInt: 1 }] }, client)).toBeFalse();
    expect(matchesResponse({ answers: [{ questionId: 'q2', answerText: 'Ja', answerInt: 3 }] }, client)).toBeFalse();
  });
});
