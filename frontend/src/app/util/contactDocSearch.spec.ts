import { ContactDocumentationOptions } from '../../../../shared/sharedGlobals';
import {
  excerpts,
  findMatches,
  highlight,
  searchContactDocumentation,
  searchContactDocumentations,
  TextSegment,
} from './contactDocSearch';

/** Joins segments back into text, marking hits as [hit]. */
function render(segments: TextSegment[]): string {
  return segments.map((s) => (s.match ? `[${s.text}]` : s.text)).join('');
}

const allgemein = ContactDocumentationOptions['beratungsThemenAllgemein'];
const wohnsituation = allgemein.find((o) => o.text === 'Wohnsituation')!;
const finanzen = allgemein.find((o) => o.text === 'Finanzen')!;

function doc(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'doc-1',
    caseId: 'case-1',
    date: new Date('2026-01-15'),
    beratungsThemenEltern: [],
    beratungsThemenKinder: [],
    beratungsThemenAllgemein: [],
    zusammenfassung: null,
    dokumentation: null,
    ...overrides,
  };
}

describe('contactDocSearch', () => {
  it('finds every occurrence regardless of case', () => {
    expect(findMatches('Wohnung, WOHNUNG, wohnung', 'wohnung')).toEqual([
      [0, 7],
      [9, 16],
      [18, 25],
    ]);
  });

  it('treats the keyword literally, not as a regular expression', () => {
    expect(findMatches('Kosten (Miete) 1.2', '(miete)')).toEqual([[7, 14]]);
    expect(findMatches('a+b', 'a.b')).toEqual([]);
  });

  it('highlights hits in the whole text', () => {
    expect(render(highlight('Miete und Nebenkosten-Miete', 'miete'))).toBe(
      '[Miete] und Nebenkosten-[Miete]',
    );
  });

  it('builds one excerpt per hit with context and ellipses', () => {
    const text = 'a '.repeat(50) + 'Jugendamt' + ' b'.repeat(80) + ' Jugendamt' + ' c'.repeat(50);
    const result = excerpts(text, 'jugendamt', 10);
    expect(result.length).toBe(2);
    for (const excerpt of result) {
      const rendered = render(excerpt);
      expect(rendered).toContain('[Jugendamt]');
      expect(rendered.startsWith('… ')).toBeTrue();
      expect(rendered.endsWith(' …')).toBeTrue();
    }
  });

  it('merges hits that are close to each other into one excerpt', () => {
    const text = 'Heute Termin beim Jobcenter, danach nochmal Jobcenter angerufen.';
    const result = excerpts(text, 'jobcenter', 20);
    expect(result.length).toBe(1);
    expect(render(result[0])).toBe(
      'Heute Termin beim [Jobcenter], danach nochmal [Jobcenter] angerufen.',
    );
  });

  it('does not cut words at the excerpt borders', () => {
    const text = 'Vorgestern Gespräch über Kitaplatz geführt und Formulare ausgefüllt';
    const rendered = render(excerpts(text, 'kitaplatz', 12)[0]);
    expect(rendered).toBe('… über [Kitaplatz] geführt und …');
  });

  it('returns null when the keyword is nowhere', () => {
    expect(
      searchContactDocumentation(doc({ zusammenfassung: 'Telefonat' }), 'hausbesuch'),
    ).toBeNull();
  });

  it('reports a topic hit with all selected topics of that field', () => {
    const hit = searchContactDocumentation(
      doc({ beratungsThemenAllgemein: [wohnsituation.id, finanzen.id] }),
      'WOHN',
    )!;
    expect(hit.topics.length).toBe(1);
    expect(hit.topics[0].label).toBe('Allgemeine Beratungsthemen');
    expect(hit.topics[0].topics.map(render)).toEqual(['[Wohn]situation', 'Finanzen']);
    expect(hit.zusammenfassung).toBeUndefined();
    expect(hit.dokumentation).toEqual([]);
  });

  it('highlights the summary only when it matches', () => {
    const hit = searchContactDocumentation(
      doc({ zusammenfassung: 'Hausbesuch am Morgen', dokumentation: 'Der Hausbesuch verlief gut.' }),
      'hausbesuch',
    )!;
    expect(render(hit.zusammenfassung!)).toBe('[Hausbesuch] am Morgen');
    expect(hit.dokumentation.length).toBe(1);

    const docOnly = searchContactDocumentation(
      doc({ zusammenfassung: 'Termin', dokumentation: 'Der Hausbesuch verlief gut.' }),
      'hausbesuch',
    )!;
    expect(docOnly.zusammenfassung).toBeUndefined();
  });

  it('copes with omitted text fields (anonymized roles)', () => {
    const d = doc({ beratungsThemenAllgemein: [finanzen.id] });
    delete d.zusammenfassung;
    delete d.dokumentation;
    expect(searchContactDocumentation(d, 'finanz')).not.toBeNull();
  });

  it('sorts hits newest first with undated docs last', () => {
    const hits = searchContactDocumentations(
      [
        doc({ id: 'old', date: new Date('2025-01-01'), zusammenfassung: 'Kita' }),
        doc({ id: 'none', date: null, zusammenfassung: 'Kita' }),
        doc({ id: 'new', date: new Date('2026-03-01'), zusammenfassung: 'Kita' }),
        doc({ id: 'miss', zusammenfassung: 'Schule' }),
      ],
      'kita',
    );
    expect(hits.map((h) => h.doc.id)).toEqual(['new', 'old', 'none']);
  });
});
