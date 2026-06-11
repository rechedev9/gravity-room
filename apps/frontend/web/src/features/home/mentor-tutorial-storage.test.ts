import { describe, it, expect, beforeEach } from 'bun:test';
import {
  MENTOR_STORAGE_KEY,
  loadMentorState,
  saveMentorState,
  clearMentorState,
  deriveInitialStep,
  type MentorTutorialPayload,
} from './mentor-tutorial-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRaw(value: string) {
  localStorage.setItem(MENTOR_STORAGE_KEY, value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mentor-tutorial-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── loadMentorState ────────────────────────────────────────────────────

  describe('loadMentorState', () => {
    it('returns null when localStorage is empty', () => {
      expect(loadMentorState()).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      setRaw('not-json{{{');
      expect(loadMentorState()).toBeNull();
    });

    it('returns null for valid JSON but wrong schema (missing version)', () => {
      setRaw(JSON.stringify({ completedAt: '2024-01-01' }));
      expect(loadMentorState()).toBeNull();
    });

    it('returns null for valid JSON but wrong version number', () => {
      setRaw(JSON.stringify({ version: 2, completedAt: '2024-01-01' }));
      expect(loadMentorState()).toBeNull();
    });

    it('returns null for non-object JSON (array)', () => {
      setRaw(JSON.stringify([1, 2, 3]));
      expect(loadMentorState()).toBeNull();
    });

    it('returns null for null JSON value', () => {
      setRaw('null');
      expect(loadMentorState()).toBeNull();
    });

    it('returns the payload for a minimal valid entry', () => {
      const payload: MentorTutorialPayload = { version: 1 };
      setRaw(JSON.stringify(payload));
      expect(loadMentorState()).toEqual(payload);
    });

    it('returns the payload with optional fields intact', () => {
      const payload: MentorTutorialPayload = {
        version: 1,
        completedAt: '2024-06-01T10:00:00.000Z',
        lastStep: 'step_profile',
      };
      setRaw(JSON.stringify(payload));
      expect(loadMentorState()).toEqual(payload);
    });
  });

  // ── saveMentorState ────────────────────────────────────────────────────

  describe('saveMentorState', () => {
    it('persists a payload that can be loaded back', () => {
      const payload: MentorTutorialPayload = {
        version: 1,
        lastStep: 'step_programs',
      };
      saveMentorState(payload);
      expect(loadMentorState()).toEqual(payload);
    });

    it('overwrites a previous entry', () => {
      saveMentorState({ version: 1, lastStep: 'step_home' });
      saveMentorState({
        version: 1,
        lastStep: 'step_tracker',
        completedAt: '2024-01-01T00:00:00.000Z',
      });
      const loaded = loadMentorState();
      expect(loaded?.lastStep).toBe('step_tracker');
      expect(loaded?.completedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  // ── clearMentorState ───────────────────────────────────────────────────

  describe('clearMentorState', () => {
    it('removes the key so loadMentorState returns null', () => {
      saveMentorState({ version: 1, lastStep: 'step_home' });
      clearMentorState();
      expect(loadMentorState()).toBeNull();
    });

    it('is a no-op when storage is already empty', () => {
      expect(() => clearMentorState()).not.toThrow();
      expect(loadMentorState()).toBeNull();
    });
  });

  // ── deriveInitialStep ──────────────────────────────────────────────────

  describe('deriveInitialStep', () => {
    it('returns "fresh" when persisted is null (empty storage)', () => {
      expect(deriveInitialStep(null)).toBe('fresh');
    });

    it('returns "returning_hint" when completedAt is set', () => {
      expect(deriveInitialStep({ version: 1, completedAt: '2024-01-01T00:00:00.000Z' })).toBe(
        'returning_hint'
      );
    });

    it('returns "dismissed" when dismissedAt is set (and no completedAt)', () => {
      expect(deriveInitialStep({ version: 1, dismissedAt: '2024-01-01T00:00:00.000Z' })).toBe(
        'dismissed'
      );
    });

    it('completedAt takes priority over dismissedAt', () => {
      expect(
        deriveInitialStep({
          version: 1,
          completedAt: '2024-01-01T00:00:00.000Z',
          dismissedAt: '2024-01-01T00:00:00.000Z',
        })
      ).toBe('returning_hint');
    });

    it('returns lastStep when only lastStep is set', () => {
      expect(deriveInitialStep({ version: 1, lastStep: 'step_tracker' })).toBe('step_tracker');
    });

    it('returns "fresh" for a minimal payload with no optional fields', () => {
      expect(deriveInitialStep({ version: 1 })).toBe('fresh');
    });
  });
});
