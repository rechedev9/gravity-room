import { describe, it, expect, beforeEach } from 'bun:test';
import { getNote, setNote, deleteNote } from './notes-storage';

// ---------------------------------------------------------------------------
// Tests (REQ-WN-001)
// ---------------------------------------------------------------------------

describe('notes-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getNote returns undefined when key does not exist', () => {
    const result = getNote('inst', 0, 't1');

    expect(result).toBeUndefined();
  });

  it('setNote + getNote round-trip returns stored text', () => {
    setNote('inst', 0, 't1', 'hello');

    const result = getNote('inst', 0, 't1');

    expect(result).toBe('hello');
  });

  it('setNote with empty string deletes the key', () => {
    setNote('inst', 0, 't1', 'hello');

    setNote('inst', 0, 't1', '');

    expect(getNote('inst', 0, 't1')).toBeUndefined();
  });

  it('deleteNote removes an existing key', () => {
    setNote('inst', 0, 't1', 'some note');

    deleteNote('inst', 0, 't1');

    expect(getNote('inst', 0, 't1')).toBeUndefined();
  });

  it('different slotKey values are stored independently', () => {
    setNote('inst', 0, 't1', 'note for t1');
    setNote('inst', 0, 't2', 'note for t2');

    expect(getNote('inst', 0, 't1')).toBe('note for t1');
    expect(getNote('inst', 0, 't2')).toBe('note for t2');
  });

  it('key format is notes:{instanceId}:{workoutIndex}:{slotKey}', () => {
    setNote('my-inst', 3, 'slot-a', 'test');

    const stored = localStorage.getItem('notes:my-inst:3:slot-a');

    expect(stored).toBe('test');
  });
});
