import { describe, expect, it } from 'vitest';
import {
  buildPaletteSections,
  flattenSections,
  normalizeQuery,
  parseDayQuery,
  type PaletteNavEntry,
  type PaletteProgram,
} from './palette-results';

const NAV: readonly PaletteNavEntry[] = [
  { id: 'today', label: 'Hoy', to: '/app' },
  { id: 'train', label: 'Entrenar', to: '/app/tracker' },
  { id: 'progress', label: 'Progreso', to: '/app/insights' },
];

const PROGRAM: PaletteProgram = { currentDay: 8, totalDays: 90, workoutsPerWeek: 4 };

describe('normalizeQuery', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeQuery('  DÍA ')).toBe('dia');
  });
});

describe('parseDayQuery', () => {
  it('accepts a bare number and the "día N" form', () => {
    expect(parseDayQuery('34')).toBe(34);
    expect(parseDayQuery('día 34')).toBe(34);
    expect(parseDayQuery('DIA 7')).toBe(7);
  });

  it('rejects everything else', () => {
    expect(parseDayQuery('')).toBeNull();
    expect(parseDayQuery('0')).toBeNull();
    expect(parseDayQuery('bench')).toBeNull();
    expect(parseDayQuery('12a')).toBeNull();
  });
});

describe('buildPaletteSections', () => {
  it('shows every section and the upcoming days before typing', () => {
    const sections = buildPaletteSections({
      query: '',
      nav: NAV,
      program: PROGRAM,
      exercises: [{ id: 'e1', name: 'Bench Press' }],
    });

    expect(sections.map((section) => section.id)).toEqual(['go', 'days']);
    expect(flattenSections(sections).map((entry) => entry.id)).toEqual([
      'nav-today',
      'nav-train',
      'nav-progress',
      'day-8',
      'day-9',
      'day-10',
      'day-11',
    ]);
  });

  it('never lists past the program total', () => {
    const sections = buildPaletteSections({
      query: '',
      nav: [],
      program: { currentDay: 89, totalDays: 90, workoutsPerWeek: 4 },
      exercises: [],
    });
    expect(flattenSections(sections).map((entry) => entry.id)).toEqual(['day-89', 'day-90']);
  });

  it('filters the go-to section ignoring case and accents', () => {
    const sections = buildPaletteSections({
      query: 'progresó',
      nav: NAV,
      program: PROGRAM,
      exercises: [],
    });
    expect(flattenSections(sections)).toEqual([
      { kind: 'nav', id: 'nav-progress', to: '/app/insights', label: 'Progreso' },
    ]);
  });

  it('turns a typed day into a jump entry with its week', () => {
    const sections = buildPaletteSections({
      query: 'día 34',
      nav: NAV,
      program: PROGRAM,
      exercises: [],
    });
    const days = sections.find((section) => section.id === 'days');
    expect(days?.entries).toEqual([{ kind: 'day', id: 'day-34', day: 34, week: 9, jump: true }]);
    expect(sections.find((section) => section.id === 'go')).toBeUndefined();
  });

  it('drops day queries outside the program', () => {
    const sections = buildPaletteSections({
      query: '91',
      nav: NAV,
      program: PROGRAM,
      exercises: [],
    });
    expect(sections).toEqual([]);
  });

  it('lists the exercises the server already filtered, capped by the limit', () => {
    const sections = buildPaletteSections({
      query: 'sent',
      nav: [],
      program: null,
      exercises: Array.from({ length: 9 }, (_, index) => ({
        id: `e${index}`,
        name: `Sentadilla ${index}`,
      })),
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.entries).toHaveLength(6);
  });

  it('returns no sections when nothing matches', () => {
    const sections = buildPaletteSections({
      query: 'zzz',
      nav: NAV,
      program: PROGRAM,
      exercises: [],
    });
    expect(sections).toEqual([]);
  });
});
