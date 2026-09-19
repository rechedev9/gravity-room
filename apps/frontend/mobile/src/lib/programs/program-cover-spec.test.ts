import { PROGRAM_CATALOG } from '@gzclp/domain';
import { hashIdentity, monogramFor, programCoverSpec } from './program-cover-spec';

describe('monogramFor', () => {
  it.each([
    ['GZCLP', 'GZ'],
    ['PHUL', 'PHUL'],
    ['HeXaN PPL', 'HXNP'],
    ['StrongLifts 5x5', 'SL55'],
    ["Phrak's Greyskull LP", 'PGL'],
    ['5/3/1 Boring But Big', 'BBB'],
    ['5/3/1 for Beginners', '531B'],
    ['Nivel 7', 'N7'],
    ['Caparazón de Tortuga', 'CT'],
    ["365 Programmare l'Ipertrofia", '365P'],
    ['La Sala del Tiempo', 'ST'],
    ['La Sala del Tiempo 2', 'ST2'],
    ['Tenkaichi Budokai — Press Banca', 'TBPB'],
    ['Furia Oscura', 'FO'],
    ['mi rutina de fuerza', 'MRF'],
  ])('%s → %s', (name, expected) => {
    expect(monogramFor(name)).toBe(expected);
  });
});

describe('programCoverSpec', () => {
  it('is deterministic for the same identity', () => {
    const a = programCoverSpec({ programId: 'gzclp' });
    const b = programCoverSpec({ programId: 'gzclp' });
    expect(a).toEqual(b);
  });

  it('gives every catalog program a distinct seed and a well-formed spec', () => {
    const specs = PROGRAM_CATALOG.map((entry) => programCoverSpec({ programId: entry.id }));
    expect(new Set(specs.map((spec) => spec.seed)).size).toBe(PROGRAM_CATALOG.length);
    for (const spec of specs) {
      expect(spec.monogram.length).toBeGreaterThanOrEqual(2);
      expect(spec.monogram.length).toBeLessThanOrEqual(4);
      expect(spec.rhythm).toHaveLength(spec.density);
      expect(spec.focal).toBeLessThan(spec.density);
    }
  });

  it('resolves catalog metadata from the program id alone', () => {
    const spec = programCoverSpec({ programId: 'hexan-ppl' });
    expect(spec.motif).toBe('columns');
    expect(spec.density).toBeGreaterThanOrEqual(5);
    expect(spec.monogram).toBe('HXNP');
  });

  it('maps categories to motifs and levels to density', () => {
    const base = { title: 'Alfa Beta' };
    expect(programCoverSpec({ ...base, category: 'strength', level: 'beginner' }).motif).toBe(
      'bars'
    );
    expect(programCoverSpec({ ...base, category: 'powerlifting' }).motif).toBe('arcs');
    const beginner = programCoverSpec({ ...base, level: 'beginner' }).density;
    const advanced = programCoverSpec({ ...base, level: 'advanced' }).density;
    expect(beginner).toBeGreaterThanOrEqual(3);
    expect(beginner).toBeLessThanOrEqual(4);
    expect(advanced).toBeGreaterThanOrEqual(7);
    expect(advanced).toBeLessThanOrEqual(8);
  });

  it('falls back to a hatch cover seeded by the title for custom plans', () => {
    const spec = programCoverSpec({ programId: undefined, title: 'Mi rutina de fuerza' });
    expect(spec.motif).toBe('hatch');
    expect(spec.seed).toBe(hashIdentity('Mi rutina de fuerza'));
    expect(spec.monogram).toBe('MRF');
    expect(spec.ticks).toBe(0);
  });

  it('prefers explicit metadata over the catalog and clamps ticks', () => {
    const spec = programCoverSpec({
      programId: 'gzclp',
      title: 'Renamed',
      category: 'hypertrophy',
      workoutsPerWeek: 12,
    });
    expect(spec.motif).toBe('columns');
    expect(spec.monogram).toBe('RE');
    expect(spec.ticks).toBe(7);
  });

  it('produces an empty monogram when nothing names the program', () => {
    expect(programCoverSpec({}).monogram).toBe('');
  });
});
