import { PROGRAM_CATALOG } from './catalog';

/**
 * Deterministic description of a program cover. Pure data: `programCoverLayout`
 * turns it into geometry and each app draws that with its own SVG. The same input
 * always yields the same spec, so covers are stable across sessions, devices and apps.
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

export type CoverVariant = 'cover' | 'thumbnail';

/** Which palette slot a shape uses; the renderer maps tones to design tokens. */
export type CoverTone = 'focal' | 'shape' | 'quiet';

export type CoverShape =
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly tone: CoverTone;
    }
  | {
      readonly kind: 'circle';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly strokeWidth: number;
      readonly tone: CoverTone;
    }
  | {
      readonly kind: 'line';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly strokeWidth: number;
      readonly tone: CoverTone;
    };

type CoverBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type CoverMonogram = {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly letterSpacing: number;
  /** Backing plate that keeps the text legible over the motif; thumbnails only. */
  readonly plate: CoverBox | null;
  /** Accent underline. */
  readonly rule: CoverBox;
};

export type CoverLayout = {
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly CoverShape[];
  /** Weekly session ticks, drawn as squares of `size` in the dim accent. */
  readonly ticks: readonly { readonly x: number; readonly y: number; readonly size: number }[];
  readonly monogram: CoverMonogram | null;
};

/** Logical canvases; renderers scale the SVG to fill their parent at these ratios. */
export const COVER_CANVAS: Readonly<
  Record<CoverVariant, { readonly width: number; readonly height: number }>
> = {
  cover: { width: 180, height: 72 },
  thumbnail: { width: 72, height: 64 },
};

function toneFor(index: number, focal: number): CoverTone {
  if (index === focal) return 'focal';
  return index % 2 === 0 ? 'shape' : 'quiet';
}

/**
 * Geometry of a cover in its logical canvas. Pure and framework free so the web
 * and the mobile app draw the very same shapes from the same spec.
 */
export function programCoverLayout(spec: CoverSpec, variant: CoverVariant): CoverLayout {
  const { width, height } = COVER_CANVAS[variant];
  const compact = variant === 'thumbnail';
  const pad = compact ? 6 : 10;
  const monogramSize = compact ? 20 : Math.round(height * 0.36);
  const monogramWidth = spec.monogram.length * monogramSize * 0.42;
  // Cover: shapes live right of the monogram column, above the tick row.
  // Thumbnail: too small to split, so the motif fills the canvas, the monogram
  // overlays it and the weekly ticks are dropped.
  const showTicks = spec.ticks > 0 && !compact;
  const regionLeft = compact || spec.monogram === '' ? pad : pad + monogramWidth + pad;
  const tickRow = showTicks ? 9 : 0;
  const region = {
    left: regionLeft,
    top: pad,
    width: Math.max(0, width - regionLeft - pad),
    height: height - pad * 2 - tickRow,
  };

  const shapes: CoverShape[] = [];
  if (spec.motif === 'bars') {
    const gap = compact ? 3 : 5;
    const thickness = Math.max(3, (region.height - gap * (spec.density - 1)) / spec.density);
    spec.rhythm.forEach((value, index) => {
      const barWidth = region.width * (0.35 + 0.6 * value);
      shapes.push({
        kind: 'rect',
        x: region.left + region.width - barWidth,
        y: region.top + index * (thickness + gap),
        width: barWidth,
        height: thickness,
        tone: toneFor(index, spec.focal),
      });
    });
  } else if (spec.motif === 'columns') {
    const gap = compact ? 3 : 5;
    const columnWidth = Math.max(3, (region.width - gap * (spec.density - 1)) / spec.density);
    spec.rhythm.forEach((value, index) => {
      const columnHeight = region.height * (0.3 + 0.65 * value);
      shapes.push({
        kind: 'rect',
        x: region.left + index * (columnWidth + gap),
        y: region.top + region.height - columnHeight,
        width: columnWidth,
        height: columnHeight,
        tone: toneFor(index, spec.focal),
      });
    });
  } else if (spec.motif === 'arcs') {
    const maxRadius = Math.min(region.width, region.height) * 1.05;
    const step = maxRadius / spec.density;
    spec.rhythm.forEach((value, index) => {
      shapes.push({
        kind: 'circle',
        cx: width - pad,
        cy: pad,
        r: step * (index + 0.6) + value * step * 0.3,
        strokeWidth: Math.max(2, step * 0.45),
        tone: toneFor(index, spec.focal),
      });
    });
  } else {
    const count = spec.density * 2;
    const step = (region.width + region.height) / (count + 1);
    for (let index = 0; index < count; index += 1) {
      const jitter = spec.rhythm[index % spec.density] ?? 0.5;
      const offset = step * (index + 1) + (jitter - 0.5) * step * 0.6;
      // Diagonal from the region's top edge to its right edge (or left/bottom).
      shapes.push({
        kind: 'line',
        x1: region.left + Math.min(offset, region.width),
        y1: region.top + Math.max(0, offset - region.width),
        x2: region.left + Math.max(0, offset - region.height),
        y2: region.top + Math.min(offset, region.height),
        strokeWidth: compact ? 2 : 3,
        tone: toneFor(index, spec.focal),
      });
    }
  }

  const ticks: { x: number; y: number; size: number }[] = [];
  if (showTicks) {
    const size = 4;
    const gap = 3;
    const total = spec.ticks * size + (spec.ticks - 1) * gap;
    const startX = width - pad - total;
    for (let index = 0; index < spec.ticks; index += 1) {
      ticks.push({ x: startX + index * (size + gap), y: height - pad - size, size });
    }
  }

  let monogram: CoverMonogram | null = null;
  if (spec.monogram !== '') {
    const ruleWidth = Math.min(monogramWidth, width - pad * 2);
    monogram = {
      text: spec.monogram,
      x: pad,
      y: height - pad - (compact ? 3 : 6),
      fontSize: monogramSize,
      letterSpacing: compact ? 0 : 1,
      plate: compact
        ? {
            x: pad - 2,
            y: height - pad - 3 - monogramSize * 0.78,
            width: Math.min(monogramWidth + 4, width - pad * 2 + 4),
            height: monogramSize * 0.78 + 5,
          }
        : null,
      rule: {
        x: pad,
        y: height - pad - (compact ? 2 : 3),
        width: ruleWidth,
        height: compact ? 2 : 3,
      },
    };
  }

  return { width, height, shapes, ticks, monogram };
}
