import * as bibtex from '@retorquere/bibtex-parser';
import { loadAll } from 'js-yaml';

import { PartialCSLEntry } from './types';

// BibTeX/BibLaTeX entry type -> CSL type. Mirrors the mapping pandoc uses when
// converting a bibliography to csljson.
const TYPE_MAP: Record<string, string> = {
  article: 'article-journal',
  periodical: 'article-journal',
  suppperiodical: 'article-journal',
  book: 'book',
  bookinbook: 'chapter',
  booklet: 'pamphlet',
  collection: 'book',
  dataset: 'dataset',
  inbook: 'chapter',
  incollection: 'chapter',
  inproceedings: 'paper-conference',
  conference: 'paper-conference',
  inreference: 'entry-encyclopedia',
  manual: 'report',
  mastersthesis: 'thesis',
  misc: 'document',
  mvbook: 'book',
  mvcollection: 'book',
  mvproceedings: 'book',
  mvreference: 'book',
  online: 'webpage',
  electronic: 'webpage',
  www: 'webpage',
  patent: 'patent',
  phdthesis: 'thesis',
  proceedings: 'book',
  reference: 'book',
  report: 'report',
  software: 'software',
  standard: 'standard',
  techreport: 'report',
  thesis: 'thesis',
  unpublished: 'manuscript',
};

// langid -> CSL locale. Pandoc emits a locale rather than the babel name.
const LANG_MAP: Record<string, string> = {
  american: 'en-US',
  english: 'en-US',
  usenglish: 'en-US',
  british: 'en-GB',
  ukenglish: 'en-GB',
  australian: 'en-AU',
  canadian: 'en-CA',
  newzealand: 'en-NZ',
  german: 'de-DE',
  ngerman: 'de-DE',
  austrian: 'de-AT',
  swissgerman: 'de-CH',
  french: 'fr-FR',
  canadien: 'fr-CA',
  spanish: 'es-ES',
  italian: 'it-IT',
  portuguese: 'pt-PT',
  brazilian: 'pt-BR',
  dutch: 'nl-NL',
  danish: 'da-DK',
  swedish: 'sv-SE',
  norsk: 'nb-NO',
  finnish: 'fi-FI',
  polish: 'pl-PL',
  czech: 'cs-CZ',
  slovak: 'sk-SK',
  hungarian: 'hu-HU',
  russian: 'ru-RU',
  ukrainian: 'uk-UA',
  greek: 'el-GR',
  turkish: 'tr-TR',
  japanese: 'ja-JP',
  korean: 'ko-KR',
  chinese: 'zh-CN',
  arabic: 'ar',
  hebrew: 'he-IL',
  latin: 'la',
};

// Simple field renames. Anything not listed here is either handled explicitly
// below or dropped, matching what pandoc emits.
const FIELD_MAP: Record<string, string> = {
  abstract: 'abstract',
  addendum: 'note',
  chapter: 'chapter-number',
  doi: 'DOI',
  edition: 'edition',
  eprint: 'number',
  eventtitle: 'event-title',
  isbn: 'ISBN',
  issn: 'ISSN',
  issue: 'issue',
  issuetitle: 'volume-title',
  keywords: 'keyword',
  language: 'language',
  note: 'note',
  number: 'issue',
  organization: 'publisher',
  pagetotal: 'number-of-pages',
  part: 'part',
  pmid: 'PMID',
  pmcid: 'PMCID',
  publisher: 'publisher',
  school: 'publisher',
  institution: 'publisher',
  series: 'collection-title',
  shortjournal: 'container-title-short',
  shortseries: 'collection-title-short',
  shorttitle: 'title-short',
  subtitle: 'subtitle',
  title: 'title',
  url: 'URL',
  venue: 'event-place',
  version: 'version',
  volume: 'volume',
  volumes: 'number-of-volumes',
};

const CREATOR_MAP: Record<string, string> = {
  author: 'author',
  bookauthor: 'container-author',
  editor: 'editor',
  editora: 'editor',
  holder: 'authority',
  translator: 'translator',
};

// Fields consumed elsewhere or intentionally discarded (local file paths,
// Zotero bookkeeping, fields folded into `issued`/`container-title`, ...).
const DROPPED = new Set([
  'address',
  'annotation',
  'annote',
  'booktitle',
  'date',
  'day',
  'file',
  'groups',
  'howpublished',
  'journal',
  'journaltitle',
  'langid',
  'location',
  'month',
  'origdate',
  'timestamp',
  'type',
  'urldate',
  'year',
]);

type BibField = string | string[] | bibtex.Name[];

function asString(value: BibField): string {
  if (Array.isArray(value)) {
    const parts = value.map((v) => (typeof v === 'string' ? v : ''));
    return parts.join(', ');
  }
  return value ?? '';
}

// Pandoc applies smart punctuation when reading BibTeX: an apostrophe that
// follows a letter is a right single quote, whether it closes a contraction
// ("don't") or a plural possessive ("students' work").
function smartQuotes(str: string) {
  return str.replace(/(\p{L})'/gu, '$1’');
}

function normalizeText(value: BibField) {
  const str = asString(value).trim();
  return str ? smartQuotes(str) : '';
}

// BibTeX uses en dashes for ranges; CSL JSON from pandoc uses plain hyphens.
function normalizeRange(value: BibField) {
  return asString(value).trim().replace(/–|—/g, '-');
}

function toName(name: bibtex.Name) {
  if (name.lastName || name.firstName) {
    const out: Record<string, string> = {};
    if (name.lastName) out.family = name.lastName;
    if (name.firstName) out.given = name.firstName;
    if (name.prefix) out['dropping-particle'] = name.prefix;
    if (name.suffix) out.suffix = name.suffix;
    return out;
  }
  return { literal: name.name ?? '' };
}

function toDateParts(...parts: Array<string | undefined>) {
  const nums: number[] = [];
  for (const part of parts) {
    if (part === undefined || part === '') break;
    const n = parseInt(part, 10);
    if (isNaN(n)) break;
    nums.push(n);
  }
  return nums.length ? { 'date-parts': [nums] } : undefined;
}

// `urldate` and `date` are ISO-ish (2023-07-08); split into date-parts.
function isoToDateParts(value: BibField) {
  const str = asString(value).trim();
  if (!str) return undefined;
  const match = str.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!match) return undefined;
  return toDateParts(match[1], match[2], match[3]);
}

function entryToCSL(entry: bibtex.Entry): PartialCSLEntry {
  const fields = entry.fields as Record<string, BibField>;
  const out: Record<string, any> = {
    id: entry.key,
    type: TYPE_MAP[entry.type.toLowerCase()] ?? 'document',
  };

  for (const [field, rawValue] of Object.entries(fields)) {
    const key = field.toLowerCase();
    if (rawValue === undefined || DROPPED.has(key)) continue;

    if (CREATOR_MAP[key]) {
      const names = rawValue as bibtex.Name[];
      if (
        Array.isArray(names) &&
        names.length &&
        typeof names[0] === 'object'
      ) {
        out[CREATOR_MAP[key]] = names.map(toName);
      }
      continue;
    }

    if (key === 'pages') {
      const page = normalizeRange(rawValue);
      if (page) out.page = page;
      continue;
    }

    const mapped = FIELD_MAP[key];
    if (!mapped) continue;

    const value = normalizeText(rawValue);
    if (value) out[mapped] = value;
  }

  // Container title: `journal`/`journaltitle` for articles, `booktitle` for
  // anything published inside a larger work.
  const container =
    normalizeText(fields.journal) ||
    normalizeText(fields.journaltitle) ||
    normalizeText(fields.booktitle);
  if (container) out['container-title'] = container;

  const place = normalizeText(fields.address) || normalizeText(fields.location);
  if (place) out['publisher-place'] = place;

  // `date` wins over year/month/day, as in biblatex.
  const issued =
    isoToDateParts(fields.date) ??
    toDateParts(
      asString(fields.year),
      asString(fields.month),
      asString(fields.day)
    );
  if (issued) out.issued = issued;

  const accessed = isoToDateParts(fields.urldate);
  if (accessed) out.accessed = accessed;

  const langid = asString(fields.langid).toLowerCase();
  if (langid) out.language = LANG_MAP[langid] ?? langid;

  // A `type` field on a thesis/report carries the genre, not the CSL type.
  const genre = normalizeText(fields.type);
  if (genre) out.genre = genre;

  return out as PartialCSLEntry;
}

export function parseBibTeX(content: string): PartialCSLEntry[] {
  const parsed = bibtex.parse(content, {
    // Reproduces pandoc's casing: sentence case for the entry's language, with
    // brace protected segments left alone.
    sentenceCase: true,
    verbatimFields: ['file', 'doi', 'url', 'eprint'],
  });

  return parsed.entries.map(entryToCSL);
}

// CSL YAML may carry dates in the legacy expanded form
// (`issued: [{year: 2013, month: 1}]`); pandoc emits `date-parts`.
function normalizeYAMLDate(value: any) {
  if (!value || typeof value !== 'object') return value;
  if (value['date-parts'] || value.raw || value.literal) return value;

  const parts = Array.isArray(value) ? value : [value];
  const dateParts: number[][] = [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const nums: number[] = [];
    if (part.year !== undefined) nums.push(Number(part.year));
    // CSL encodes seasons as months 21-24.
    if (part.season !== undefined) nums.push(20 + Number(part.season));
    else if (part.month !== undefined) nums.push(Number(part.month));
    if (part.day !== undefined) nums.push(Number(part.day));
    if (nums.length) dateParts.push(nums);
  }

  return dateParts.length ? { 'date-parts': dateParts } : value;
}

const DATE_FIELDS = [
  'accessed',
  'available-date',
  'event-date',
  'issued',
  'original-date',
  'submitted',
];

// A CSL YAML bibliography is already CSL shaped: either a bare list, or a
// mapping with a `references` key (pandoc's metadata format).
export function parseCSLYAML(content: string): PartialCSLEntry[] {
  const docs: any[] = [];
  loadAll(content, (doc) => docs.push(doc));

  const entries: any[] = [];
  for (const doc of docs) {
    if (!doc) continue;
    if (Array.isArray(doc)) entries.push(...doc);
    else if (Array.isArray(doc.references)) entries.push(...doc.references);
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    for (const field of DATE_FIELDS) {
      if (entry[field]) entry[field] = normalizeYAMLDate(entry[field]);
    }
  }

  return entries as PartialCSLEntry[];
}

export function parseBibliography(
  content: string,
  ext: string
): PartialCSLEntry[] {
  switch (ext.toLowerCase()) {
    case '.json':
    case '.csljson':
      return JSON.parse(content);
    case '.yaml':
    case '.yml':
      return parseCSLYAML(content);
    default:
      return parseBibTeX(content);
  }
}
