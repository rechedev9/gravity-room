import { describe, it, expect } from 'bun:test';
import { getProgramDefinition, getAllPresetPrograms } from './registry';

// ---------------------------------------------------------------------------
// Registry integration tests — real lookup through the real definition map
// ---------------------------------------------------------------------------
describe('program registry', () => {
  it('should return GZCLP definition by ID', () => {
    const gzclp = getProgramDefinition('gzclp');
    expect(gzclp).toBeDefined();
    expect(gzclp?.id).toBe('gzclp');
    expect(gzclp?.name).toBe('GZCLP');
  });

  it('should return undefined for unknown program ID', () => {
    expect(getProgramDefinition('nonexistent')).toBeUndefined();
  });

  it('should list all preset programs', () => {
    const all = getAllPresetPrograms();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((p) => p.id === 'gzclp')).toBe(true);
  });
});
