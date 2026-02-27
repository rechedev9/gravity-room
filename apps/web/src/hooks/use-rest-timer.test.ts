import { describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from './use-rest-timer';

// ---------------------------------------------------------------------------
// useRestTimer — unit tests (REQ-RT-001, REQ-RT-004)
//
// Note: bun:test fake timers (mock.timers) are not available in the web
// test environment (happy-dom preload). Tests verify state transitions
// without relying on timer advancement.
// ---------------------------------------------------------------------------

const DURATION_KEY = 'rest-timer-duration';
const DURATION_DEFAULT = 90;

beforeEach(() => {
  localStorage.clear();
});

describe('useRestTimer', () => {
  describe('initial state', () => {
    it('returns remaining=0 and isRunning=false on init', () => {
      const { result } = renderHook(() => useRestTimer());

      expect(result.current.remaining).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });

    it('uses DURATION_DEFAULT=90 when no localStorage value', () => {
      const { result } = renderHook(() => useRestTimer());

      expect(result.current.duration).toBe(DURATION_DEFAULT);
    });

    it('falls back to DURATION_DEFAULT when localStorage value is invalid', () => {
      localStorage.setItem(DURATION_KEY, 'garbage');

      const { result } = renderHook(() => useRestTimer());

      expect(result.current.duration).toBe(DURATION_DEFAULT);
    });
  });

  describe('start()', () => {
    it('sets isRunning=true after start()', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);
    });

    it('sets remaining to configured duration after start()', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.remaining).toBe(DURATION_DEFAULT);
    });
  });

  describe('stop()', () => {
    it('sets remaining=0 and isRunning=false', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.remaining).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('startIfIdle()', () => {
    it('sets isRunning=true when timer is idle', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.startIfIdle();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.remaining).toBe(DURATION_DEFAULT);
    });

    it('does NOT restart when timer is already running', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.start();
      });

      const remainingAfterStart = result.current.remaining;

      act(() => {
        result.current.startIfIdle();
      });

      // remaining should not have been reset — still same as before
      expect(result.current.remaining).toBe(remainingAfterStart);
    });
  });

  describe('setDuration()', () => {
    it('updates duration state and writes to localStorage for valid value', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.setDuration(120);
      });

      expect(result.current.duration).toBe(120);
      expect(localStorage.getItem(DURATION_KEY)).toBe('120');
    });

    it('does NOT update duration or localStorage for value below minimum (5)', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.setDuration(5);
      });

      expect(result.current.duration).toBe(DURATION_DEFAULT);
      expect(localStorage.getItem(DURATION_KEY)).toBeNull();
    });

    it('does NOT update duration for non-integer value', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.setDuration(45.5);
      });

      expect(result.current.duration).toBe(DURATION_DEFAULT);
    });

    it('does NOT update duration for value above maximum (>600)', () => {
      const { result } = renderHook(() => useRestTimer());

      act(() => {
        result.current.setDuration(601);
      });

      expect(result.current.duration).toBe(DURATION_DEFAULT);
    });
  });
});
