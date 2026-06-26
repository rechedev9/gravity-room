import { describe, it, expect, beforeEach } from 'vitest';
import {
  MENTOR_TOUR_KEY,
  loadTourState,
  saveTourState,
  clearTourState,
  dismissZoneHint,
  shouldShowZoneHint,
  dismissChecklist,
  shouldShowChecklist,
  shouldShowPrompt,
  startTour,
  getDismissedZones,
  TOUR_ZONES,
  type MentorTourPayload,
} from './mentor-tour-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRaw(value: string) {
  localStorage.setItem(MENTOR_TOUR_KEY, value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mentor-tour-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── loadTourState ──────────────────────────────────────────────────────

  describe('loadTourState', () => {
    it('returns null when localStorage is empty', () => {
      expect(loadTourState()).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      setRaw('not-json{{{');
      expect(loadTourState()).toBeNull();
    });

    it('returns null for wrong version', () => {
      setRaw(JSON.stringify({ version: 1, completedAt: '2024-01-01' }));
      expect(loadTourState()).toBeNull();
    });

    it('returns payload for valid v2 entry', () => {
      const payload: MentorTourPayload = { version: 2 };
      setRaw(JSON.stringify(payload));
      expect(loadTourState()).toEqual(payload);
    });

    it('returns payload with optional fields intact', () => {
      const payload: MentorTourPayload = {
        version: 2,
        dismissedZones: ['home', 'programs'],
        checklistDismissed: false,
      };
      setRaw(JSON.stringify(payload));
      expect(loadTourState()).toEqual(payload);
    });
  });

  // ── saveTourState / clearTourState ─────────────────────────────────────

  describe('saveTourState', () => {
    it('persists a payload that can be loaded back', () => {
      const payload: MentorTourPayload = { version: 2, dismissedZones: ['tracker'] };
      saveTourState(payload);
      expect(loadTourState()).toEqual(payload);
    });

    it('overwrites a previous entry', () => {
      saveTourState({ version: 2, dismissedZones: ['home'] });
      saveTourState({ version: 2, dismissedZones: ['home', 'profile'] });
      expect(loadTourState()?.dismissedZones).toEqual(['home', 'profile']);
    });
  });

  describe('clearTourState', () => {
    it('removes the key so loadTourState returns null', () => {
      saveTourState({ version: 2 });
      clearTourState();
      expect(loadTourState()).toBeNull();
    });

    it('is a no-op when storage is already empty', () => {
      expect(() => clearTourState()).not.toThrow();
    });
  });

  // ── dismissZoneHint ────────────────────────────────────────────────────

  describe('dismissZoneHint', () => {
    it('adds the zone to dismissedZones', () => {
      dismissZoneHint('home');
      expect(loadTourState()?.dismissedZones).toContain('home');
    });

    it('is idempotent — does not duplicate zones', () => {
      dismissZoneHint('programs');
      dismissZoneHint('programs');
      const zones = loadTourState()?.dismissedZones ?? [];
      expect(zones.filter((z) => z === 'programs').length).toBe(1);
    });

    it('sets completedAt when all zones are dismissed', () => {
      for (const zone of TOUR_ZONES) {
        dismissZoneHint(zone);
      }
      expect(loadTourState()?.completedAt).toBeDefined();
    });

    it('does not set completedAt when only some zones are dismissed', () => {
      dismissZoneHint('home');
      dismissZoneHint('programs');
      expect(loadTourState()?.completedAt).toBeUndefined();
    });
  });

  // ── shouldShowZoneHint ─────────────────────────────────────────────────

  describe('shouldShowZoneHint', () => {
    it('returns true for a brand-new user (empty storage)', () => {
      expect(shouldShowZoneHint('home')).toBe(true);
    });

    it('returns false after the zone has been dismissed', () => {
      dismissZoneHint('tracker');
      expect(shouldShowZoneHint('tracker')).toBe(false);
    });

    it('returns true for a zone that has not been dismissed', () => {
      dismissZoneHint('home');
      expect(shouldShowZoneHint('programs')).toBe(true);
    });

    it('returns false for all zones when checklistDismissed is true', () => {
      saveTourState({ version: 2, checklistDismissed: true });
      for (const zone of TOUR_ZONES) {
        expect(shouldShowZoneHint(zone)).toBe(false);
      }
    });
  });

  // ── dismissChecklist / shouldShowChecklist ─────────────────────────────

  describe('dismissChecklist', () => {
    it('sets checklistDismissed to true', () => {
      dismissChecklist();
      expect(loadTourState()?.checklistDismissed).toBe(true);
    });
  });

  describe('shouldShowChecklist', () => {
    it('returns false for a brand-new user (prompt shown first)', () => {
      expect(shouldShowChecklist()).toBe(false);
    });

    it('returns true when tourStarted is set', () => {
      saveTourState({ version: 2, tourStarted: true });
      expect(shouldShowChecklist()).toBe(true);
    });

    it('returns false after dismissChecklist', () => {
      dismissChecklist();
      expect(shouldShowChecklist()).toBe(false);
    });

    it('returns false when completedAt is set', () => {
      saveTourState({ version: 2, tourStarted: true, completedAt: '2024-01-01T00:00:00.000Z' });
      expect(shouldShowChecklist()).toBe(false);
    });

    it('returns true for a v2 payload with tourStarted and no dismissal or completion', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: ['home'] });
      expect(shouldShowChecklist()).toBe(true);
    });
  });

  // ── getDismissedZones ──────────────────────────────────────────────────

  describe('getDismissedZones', () => {
    it('returns an empty set for a new user', () => {
      expect(getDismissedZones().size).toBe(0);
    });

    it('returns the set of dismissed zones', () => {
      dismissZoneHint('home');
      dismissZoneHint('profile');
      const zones = getDismissedZones();
      expect(zones.has('home')).toBe(true);
      expect(zones.has('profile')).toBe(true);
      expect(zones.has('programs')).toBe(false);
    });
  });

  // ── shouldShowPrompt ───────────────────────────────────────────────────

  describe('shouldShowPrompt', () => {
    it('returns true for a brand-new user', () => {
      expect(shouldShowPrompt()).toBe(true);
    });

    it('returns false after tourStarted is set', () => {
      saveTourState({ version: 2, tourStarted: true });
      expect(shouldShowPrompt()).toBe(false);
    });

    it('returns false after checklistDismissed is set', () => {
      saveTourState({ version: 2, checklistDismissed: true });
      expect(shouldShowPrompt()).toBe(false);
    });
  });

  // ── startTour ──────────────────────────────────────────────────────────

  describe('startTour', () => {
    it('sets tourStarted to true in storage', () => {
      startTour();
      expect(loadTourState()?.tourStarted).toBe(true);
    });

    it('preserves existing dismissedZones when starting tour', () => {
      saveTourState({ version: 2, dismissedZones: ['home'] });
      startTour();
      expect(loadTourState()?.dismissedZones).toContain('home');
    });
  });
});
