import { PROGRAM_CATALOG } from '@gzclp/domain';

/**
 * Deterministic description of a program cover. Pure data: the SVG renderer in
 * `ui/program-cover.tsx` turns it into geometry. The same input always yields
 * the same spec, so covers are stable across sessions and devices.
 */

export type CoverMotif = 'bars' | 'columns' | 'arcs' | 'hatch';

export type CoverSpec = {
  /** 32-bit hash of the identity string; drives layout jitter. */
  readonly seed: number;
  readonly motif: CoverMotif;
  /** Number of primary shapes; grows with program level. */
  readonly density: number;
  /** `density` values in [0, 1) derived from the seed; shape sizes. */
  readonly rhythm: readonly number[];
  /** Index of the shape drawn in the accent colour. */
  readonly focal: number;
  /** 2–4 uppercase characters, or empty when no name is known. */
  readonly monogram: string;
  /** Weekly session count, 0 when unknown. */
  readonly ticks: number;
};

export type CoverInput = {
  readonly programId?: string | undefined;
  readonly title?: string | undefined;
  readonly category?: string | undefined;
  readonly level?: string | undefined;
  readonly workoutsPerWeek?: number | undefined;
};

const MOTIF_BY_CATEGORY: Readonly<Record<string, CoverMotif>> = {
  strength: 'bars',
  hypertrophy: 'columns',
  powerlifting: 'arcs',
};

const BASE_DENSITY: Readonly<Record<string, number>> = {
  beginner: 3,
  intermediate: 5,
  advanced: 7,
};

const STOPWORDS = new Set([
  'la',
  'el',
  'los',
  'las',
  'de',
  'del',
  'l',
  'the',
  'for',
  'of',
  'a',
  'and',
  'y',
  'e',
  'il',
  'lo',
]);

const MAX_MONOGRAM = 4;

/** FNV-1a over UTF-16 code units; unsigned 32-bit result. */
export function hashIdentity(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32: tiny seeded PRNG, enough for layout jitter. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function splitCamel(token: string): readonly string[] {
  return token.split(/(?<=[a-z])(?=[A-Z])/u).filter((part) => part.length > 0);
}

/**
 * Abbreviate a program name. Alphabetic tokens contribute their initial (camel
 * case splits, e.g. StrongLifts → S, L); numeric tokens keep their digits
 * (5/3/1 → 531); stop words are skipped. Three or more initials win over
 * digits so "5/3/1 Boring But Big" reads BBB while "5/3/1 for Beginners" reads 531B.
 */
export function monogramFor(name: string): string {
  const tokens = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/gu, ' ')
    .split(/[\s\-—–_/:,.()]+/u)
    .filter((token) => token.length > 0);
  const [first] = tokens;
  if (tokens.length === 1 && first !== undefined) {
    const only = first.toUpperCase();
    return only.length <= MAX_MONOGRAM ? only : only.slice(0, 2);
  }
  const ordered: string[] = [];
  const initials: string[] = [];
  for (const token of tokens) {
    // Possessive/elision leftovers ("Phrak s", "l Ipertrofia") carry no meaning.
    if (STOPWORDS.has(token.toLowerCase()) || /^[a-z]$/iu.test(token)) continue;
    if (/^\d/u.test(token)) {
      ordered.push(token.replace(/\D/gu, ''));
      continue;
    }
    for (const part of splitCamel(token)) {
      const initial = part.charAt(0).toUpperCase();
      ordered.push(initial);
      initials.push(initial);
    }
  }
  if (initials.length >= 3) return initials.join('').slice(0, MAX_MONOGRAM);
  return ordered.join('').slice(0, MAX_MONOGRAM);
}

type ResolvedInput = {
  readonly title: string;
  readonly category: string;
  readonly level: string;
  readonly workoutsPerWeek: number;
};

function resolveInput(input: CoverInput): ResolvedInput {
  const preset = input.programId
    ? PROGRAM_CATALOG.find((entry) => entry.id === input.programId)
    : undefined;
  return {
    title: input.title ?? preset?.name ?? '',
    category: input.category ?? preset?.category ?? '',
    level: input.level ?? preset?.level ?? '',
    workoutsPerWeek: input.workoutsPerWeek ?? 0,
  };
}

export function programCoverSpec(input: CoverInput): CoverSpec {
  const resolved = resolveInput(input);
  const identity = input.programId ?? resolved.title;
  const seed = hashIdentity(identity);
  const random = createRandom(seed);
  const motif = MOTIF_BY_CATEGORY[resolved.category] ?? 'hatch';
  const density = (BASE_DENSITY[resolved.level] ?? 4) + (seed % 2);
  const rhythm = Array.from({ length: density }, () => random());
  const focal = Math.floor(random() * density);
  return {
    seed,
    motif,
    density,
    rhythm,
    focal,
    monogram: resolved.title === '' ? '' : monogramFor(resolved.title),
    ticks: Math.max(0, Math.min(7, Math.trunc(resolved.workoutsPerWeek))),
  };
}
