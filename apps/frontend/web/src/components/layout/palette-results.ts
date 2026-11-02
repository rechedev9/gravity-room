/**
 * Pure model behind the ⌘K palette. The component owns data fetching, focus and
 * i18n; this module only decides which entries a query surfaces, so the ranking
 * rules stay unit-testable without a renderer.
 */

export interface PaletteNavEntry {
  readonly id: string;
  readonly label: string;
  readonly to: string;
}

export interface PaletteProgram {
  /** 1-based day the lifter trains next. */
  readonly currentDay: number;
  readonly totalDays: number;
  readonly workoutsPerWeek: number;
}

export interface PaletteExerciseEntry {
  readonly id: string;
  readonly name: string;
}

export type PaletteEntry =
  | { readonly kind: 'nav'; readonly id: string; readonly to: string; readonly label: string }
  | {
      readonly kind: 'day';
      readonly id: string;
      readonly day: number;
      readonly week: number;
      /** True when the entry answers a typed day number ("34", "día 34"). */
      readonly jump: boolean;
    }
  | { readonly kind: 'exercise'; readonly id: string; readonly name: string };

export interface PaletteSection {
  readonly id: 'go' | 'days' | 'exercises';
  readonly entries: readonly PaletteEntry[];
}

export interface BuildPaletteInput {
  readonly query: string;
  readonly nav: readonly PaletteNavEntry[];
  readonly program: PaletteProgram | null;
  /** Already filtered server-side by the query; never re-filtered here. */
  readonly exercises: readonly PaletteExerciseEntry[];
  /** Upcoming days shown before the lifter types anything. */
  readonly upcomingCount?: number;
  readonly limit?: number;
}

const DEFAULT_UPCOMING = 4;
const DEFAULT_LIMIT = 6;

/** Lowercase and strip accents so "Día" matches "dia". */
export function normalizeQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** "34" and "día 34" both select day 34; anything else returns null. */
export function parseDayQuery(value: string): number | null {
  const match = /^(?:d(?:ia)?\s*)?(\d{1,3})$/.exec(normalizeQuery(value));
  if (match?.[1] === undefined) return null;
  const day = Number(match[1]);
  return Number.isInteger(day) && day > 0 ? day : null;
}

function weekOf(day: number, workoutsPerWeek: number): number {
  if (workoutsPerWeek <= 0) return 1;
  return Math.floor((day - 1) / workoutsPerWeek) + 1;
}

function dayEntry(day: number, program: PaletteProgram, jump: boolean): PaletteEntry {
  return {
    kind: 'day',
    id: `day-${day}`,
    day,
    week: weekOf(day, program.workoutsPerWeek),
    jump,
  };
}

/**
 * Sections in display order: go-to, program days, exercises. Empty sections are
 * dropped so the palette never prints a heading with nothing under it.
 */
export function buildPaletteSections(input: BuildPaletteInput): readonly PaletteSection[] {
  const query = normalizeQuery(input.query);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const upcoming = input.upcomingCount ?? DEFAULT_UPCOMING;

  const nav: PaletteEntry[] = input.nav
    .filter((entry) => query === '' || normalizeQuery(entry.label).includes(query))
    .slice(0, limit)
    .map((entry) => ({ kind: 'nav', id: `nav-${entry.id}`, to: entry.to, label: entry.label }));

  const days: PaletteEntry[] = [];
  const program = input.program;
  if (program !== null && program.totalDays > 0) {
    if (query === '') {
      const from = Math.min(Math.max(1, program.currentDay), program.totalDays);
      for (let day = from; day <= Math.min(program.totalDays, from + upcoming - 1); day += 1) {
        days.push(dayEntry(day, program, false));
      }
    } else {
      const requested = parseDayQuery(input.query);
      if (requested !== null && requested <= program.totalDays) {
        days.push(dayEntry(requested, program, true));
      }
    }
  }

  const exercises: PaletteEntry[] =
    query === ''
      ? []
      : input.exercises
          .slice(0, limit)
          .map((entry) => ({ kind: 'exercise', id: `exercise-${entry.id}`, name: entry.name }));

  const sections: readonly PaletteSection[] = [
    { id: 'go', entries: nav },
    { id: 'days', entries: days },
    { id: 'exercises', entries: exercises },
  ];
  return sections.filter((section) => section.entries.length > 0);
}

/** Flat order of the rendered options, used for arrow-key navigation. */
export function flattenSections(sections: readonly PaletteSection[]): readonly PaletteEntry[] {
  return sections.flatMap((section) => section.entries);
}

export function paletteSectionHeadingKey(id: PaletteSection['id']): string {
  return `desktop_shell.palette.sections.${id}`;
}
