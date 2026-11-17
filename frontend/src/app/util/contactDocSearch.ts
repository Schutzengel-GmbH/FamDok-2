import { ContactDocumentationOptions } from '../../../../shared/sharedGlobals';
import { FullContactDocumentation } from '../../../../shared/types';

/** Minimum number of characters (after trimming) before a keyword search may be sent. */
export const MIN_SEARCH_LENGTH = 4;

/** Characters of context shown on each side of a hit in the documentation excerpts. */
export const EXCERPT_CONTEXT = 60;

/** A piece of text, flagged when it is (part of) a search hit. */
export interface TextSegment {
  text: string;
  match: boolean;
}

/** A topic field whose selected topics contain the keyword. */
export interface TopicHit {
  label: string;
  /** All topics selected in this field, each split into highlighted segments. */
  topics: TextSegment[][];
}

/** Where a keyword was found in one contact documentation. */
export interface ContactDocSearchHit {
  doc: FullContactDocumentation;
  topics: TopicHit[];
  /** Highlighted summary; only set when the keyword occurs in it. */
  zusammenfassung?: TextSegment[];
  /** One highlighted excerpt per hit (hits close to each other share an excerpt). */
  dokumentation: TextSegment[][];
}

const TOPIC_FIELDS = [
  {
    key: 'beratungsThemenEltern',
    label: 'Beratungsthemen mit Bezug auf die Eltern',
  },
  {
    key: 'beratungsThemenKinder',
    label: 'Beratungsthemen mit Bezug auf die Kinder',
  },
  { key: 'beratungsThemenAllgemein', label: 'Allgemeine Beratungsthemen' },
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Start/end offsets of every case-insensitive occurrence of `term` in `text`. */
export function findMatches(text: string, term: string): [number, number][] {
  const needle = term.trim();
  if (!needle || !text) return [];
  const re = new RegExp(escapeRegExp(needle), 'giu');
  return [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
}

/** Splits `text[from, to)` into segments, flagging the given matches. */
function segment(
  text: string,
  matches: [number, number][],
  from = 0,
  to = text.length,
): TextSegment[] {
  const out: TextSegment[] = [];
  let pos = from;
  for (const [start, end] of matches) {
    if (end <= from || start >= to) continue;
    if (start > pos) out.push({ text: text.slice(pos, start), match: false });
    out.push({
      text: text.slice(Math.max(start, from), Math.min(end, to)),
      match: true,
    });
    pos = Math.min(end, to);
  }
  if (pos < to) out.push({ text: text.slice(pos, to), match: false });
  return out;
}

/** The whole `text`, with every occurrence of `term` flagged. */
export function highlight(text: string, term: string): TextSegment[] {
  return segment(text, findMatches(text, term));
}

/** Moves an excerpt start forward to the next word start, so it doesn't begin mid-word. */
function snapStart(text: string, from: number, firstHit: number): number {
  if (from === 0) return 0;
  for (let i = from; i < firstHit; i++) if (/\s/.test(text[i])) return i + 1;
  return from;
}

/** Moves an excerpt end back to the previous word end, so it doesn't stop mid-word. */
function snapEnd(text: string, to: number, lastHit: number): number {
  if (to >= text.length) return text.length;
  for (let i = to; i > lastHit; i--) if (/\s/.test(text[i])) return i;
  return to;
}

/**
 * Excerpts of `text` around every occurrence of `term`, `context` characters on each side.
 * Occurrences whose excerpts would overlap share one, so every hit is shown exactly once.
 */
export function excerpts(
  text: string,
  term: string,
  context = EXCERPT_CONTEXT,
): TextSegment[][] {
  const matches = findMatches(text, term);
  const windows: { from: number; to: number; firstHit: number; lastHit: number }[] = [];
  for (const [start, end] of matches) {
    const from = Math.max(0, start - context);
    const to = Math.min(text.length, end + context);
    const last = windows.at(-1);
    if (last && from <= last.to) {
      last.to = to;
      last.lastHit = end;
    } else {
      windows.push({ from, to, firstHit: start, lastHit: end });
    }
  }
  return windows.map((w) => {
    const from = snapStart(text, w.from, w.firstHit);
    const to = snapEnd(text, w.to, w.lastHit);
    const segments = segment(text, matches, from, to);
    if (from > 0) segments.unshift({ text: '… ', match: false });
    if (to < text.length) segments.push({ text: ' …', match: false });
    return segments;
  });
}

function topicHits(doc: FullContactDocumentation, term: string): TopicHit[] {
  const hits: TopicHit[] = [];
  for (const { key, label } of TOPIC_FIELDS) {
    const options = ContactDocumentationOptions[key] ?? [];
    const names = (doc[key] ?? [])
      .map((id) => options.find((o) => o.id === id)?.text)
      .filter((name): name is string => !!name);
    if (names.some((name) => findMatches(name, term).length > 0))
      hits.push({ label, topics: names.map((name) => highlight(name, term)) });
  }
  return hits;
}

/**
 * Where `term` occurs (case-insensitively) in the topics, summary or documentation text of
 * `doc`, or `null` if it occurs nowhere.
 */
export function searchContactDocumentation(
  doc: FullContactDocumentation,
  term: string,
): ContactDocSearchHit | null {
  const topics = topicHits(doc, term);
  const summary = doc.zusammenfassung ?? '';
  const zusammenfassung =
    findMatches(summary, term).length > 0 ? highlight(summary, term) : undefined;
  const dokumentation = excerpts(doc.dokumentation ?? '', term);
  if (topics.length === 0 && !zusammenfassung && dokumentation.length === 0)
    return null;
  return { doc, topics, zusammenfassung, dokumentation };
}

function timeOf(date: Date | string | null | undefined): number {
  return date ? new Date(date).getTime() : Number.NEGATIVE_INFINITY;
}

/** Searches all `docs` for `term`; the hits are sorted newest first, undated ones last. */
export function searchContactDocumentations(
  docs: FullContactDocumentation[],
  term: string,
): ContactDocSearchHit[] {
  return docs
    .map((doc) => searchContactDocumentation(doc, term))
    .filter((hit): hit is ContactDocSearchHit => hit !== null)
    .sort((a, b) => timeOf(b.doc.date) - timeOf(a.doc.date));
}
