import { describe, it, expect } from 'vitest';
import { deriveJawContext, type JawContext } from './jaw-context';

describe('deriveJawContext', () => {
  it('should return null when dayName does not contain JAW pattern', () => {
    expect(deriveJawContext('Regular Day')).toBeNull();
    expect(deriveJawContext('Legs Day')).toBeNull();
    expect(deriveJawContext('')).toBeNull();
  });

  it('should return null when block number is invalid', () => {
    expect(deriveJawContext('JAW B4')).toBeNull();
    expect(deriveJawContext('JAW Bloque 0')).toBeNull();
    expect(deriveJawContext('JAW Bloque 5')).toBeNull();
  });

  it('should parse block 1 correctly', () => {
    const result = deriveJawContext('JAW B1');
    expect(result).not.toBeNull();
    expect(result!.block).toBe(1);
    expect(result!.group).toBe('JAW Bloque 1 — TM');
  });

  it('should parse block 2 correctly', () => {
    const result = deriveJawContext('JAW Bloque 2');
    expect(result).not.toBeNull();
    expect(result!.block).toBe(2);
    expect(result!.group).toBe('JAW Bloque 2 — TM');
  });

  it('should parse block 3 correctly', () => {
    const result = deriveJawContext('JAW B3 Sem. 5');
    expect(result).not.toBeNull();
    expect(result!.block).toBe(3);
    expect(result!.group).toBe('JAW Bloque 3 — TM');
  });

  it('should extract week number from Sem. pattern', () => {
    const result = deriveJawContext('JAW B1 Sem. 2');
    expect(result).not.toBeNull();
    expect(result!.week).toBe(2);
    expect(result!.isTestWeek).toBe(false);
  });

  it('should handle Sem. with varying whitespace', () => {
    const result1 = deriveJawContext('JAW B2 Sem.1');
    expect(result1).not.toBeNull();
    expect(result1!.week).toBe(1);

    const result2 = deriveJawContext('JAW B2 Sem.  3');
    expect(result2).not.toBeNull();
    expect(result2!.week).toBe(3);
  });

  it('should identify Test Maximo as test week', () => {
    const result = deriveJawContext('JAW B1 Test Maximo');
    expect(result).not.toBeNull();
    expect(result!.isTestWeek).toBe(true);
    expect(result!.week).toBe(6);
  });

  it('should identify Recuperacion as test week', () => {
    const result = deriveJawContext('JAW B2 Recuperacion');
    expect(result).not.toBeNull();
    expect(result!.isTestWeek).toBe(true);
    expect(result!.week).toBe(12);
  });

  it('should calculate correct week for test weeks based on block', () => {
    const block1 = deriveJawContext('JAW B1 Test Maximo');
    expect(block1!.week).toBe(6);

    const block2 = deriveJawContext('JAW B2 Recuperacion');
    expect(block2!.week).toBe(12);

    const block3 = deriveJawContext('JAW B3 Test Maximo');
    expect(block3!.week).toBe(18);
  });

  it('should return null for week when no Sem. pattern and not test week', () => {
    const result = deriveJawContext('JAW B1');
    expect(result).not.toBeNull();
    expect(result!.week).toBeNull();
  });

  it('should prioritize Sem. over calculated test week', () => {
    const result = deriveJawContext('JAW B1 Sem. 3 Test Maximo');
    expect(result).not.toBeNull();
    expect(result!.week).toBe(3);
    expect(result!.isTestWeek).toBe(true);
  });

  it('should be case-sensitive for JAW pattern', () => {
    expect(deriveJawContext('jaw b1')).toBeNull();
    expect(deriveJawContext('JAW b1')).toBeNull();
  });

  it('should work with full realistic examples', () => {
    const result1 = deriveJawContext('JAW Bloque 1 Sem. 2');
    expect(result1).toEqual({
      block: 1,
      week: 2,
      isTestWeek: false,
      group: 'JAW Bloque 1 — TM',
    } as JawContext);

    const result2 = deriveJawContext('JAW B3 Test Maximo');
    expect(result2).toEqual({
      block: 3,
      week: 18,
      isTestWeek: true,
      group: 'JAW Bloque 3 — TM',
    } as JawContext);
  });
});
