import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useWebMcp } from './use-webmcp';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { GenericResults } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';
import {
  DEFAULT_WEIGHTS,
  GZCLP_DEFINITION_FIXTURE,
  buildGenericSuccessResults,
} from '../../test/helpers/fixtures';

const DEF = GZCLP_DEFINITION_FIXTURE;
const CONFIG = DEFAULT_WEIGHTS as Record<string, number>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CapturedTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly annotations?: { readonly readOnlyHint?: boolean };
  readonly execute: (input: unknown, client: unknown) => Promise<ModelContextToolResponse>;
}

/** Parse the MCP content response into a convenient shape for assertions. */
function parseResponse(resp: ModelContextToolResponse): { text: string; parsed: unknown } {
  const block = resp.content[0];
  const text = block.text;
  return { text, parsed: JSON.parse(text) as unknown };
}

/** Check if parsed response is an error (has .error field). */
function isErrorResponse(parsed: unknown): parsed is { error: string } {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'error' in parsed &&
    typeof (parsed as Record<string, unknown>).error === 'string'
  );
}

function buildOptions(overrides?: {
  config?: Record<string, number | string> | null;
  results?: GenericResults;
  rows?: readonly GenericWorkoutRow[];
}): {
  config: Record<string, number | string> | null;
  rows: readonly GenericWorkoutRow[];
  totalWorkouts: number;
  definition: typeof DEF;
  generateProgram: ReturnType<typeof mock>;
  markResult: ReturnType<typeof mock>;
  setAmrapReps: ReturnType<typeof mock>;
  undoLast: ReturnType<typeof mock>;
} {
  const cfg = overrides?.config === undefined ? CONFIG : overrides.config;
  const results = overrides?.results ?? {};
  const rows = overrides?.rows ?? (cfg ? computeGenericProgram(DEF, cfg, results) : []);
  return {
    config: cfg,
    rows,
    totalWorkouts: DEF.totalWorkouts,
    definition: DEF,
    generateProgram: mock(),
    markResult: mock(),
    setAmrapReps: mock(),
    undoLast: mock(),
  };
}

let capturedTools: CapturedTool[] = [];
let mockRegisterTool: ReturnType<typeof mock>;
let mockUnregisterTool: ReturnType<typeof mock>;
let originalModelContext: unknown;

function installMockModelContext(): void {
  capturedTools = [];
  mockRegisterTool = mock((tool: CapturedTool) => {
    capturedTools.push(tool);
  });
  mockUnregisterTool = mock();
  Object.defineProperty(navigator, 'modelContext', {
    value: {
      registerTool: mockRegisterTool,
      unregisterTool: mockUnregisterTool,
      provideContext: mock(),
      clearContext: mock(),
    },
    writable: true,
    configurable: true,
  });
}

function findTool(name: string): CapturedTool {
  const tool = capturedTools.find((t) => t.name === name);
  if (!tool)
    throw new Error(
      `Tool "${name}" not found among: ${capturedTools.map((t) => t.name).join(', ')}`
    );
  return tool;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWebMcp', () => {
  beforeEach(() => {
    originalModelContext = (navigator as unknown as Record<string, unknown>).modelContext;
  });

  afterEach(() => {
    if (originalModelContext === undefined) {
      delete (navigator as unknown as Record<string, unknown>).modelContext;
    } else {
      Object.defineProperty(navigator, 'modelContext', {
        value: originalModelContext,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('feature detection', () => {
    it('should not throw when navigator.modelContext is undefined', () => {
      delete (navigator as unknown as Record<string, unknown>).modelContext;
      const opts = buildOptions();
      expect(() => renderHook(() => useWebMcp(opts))).not.toThrow();
    });
  });

  describe('tool registration', () => {
    it('should register all 8 tools via registerTool', () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      expect(mockRegisterTool).toHaveBeenCalledTimes(8);
      const names = capturedTools.map((t) => t.name);
      expect(names).toContain('getCurrentWorkout');
      expect(names).toContain('getProgram');
      expect(names).toContain('getStats');
      expect(names).toContain('getProgress');
      expect(names).toContain('logResult');
      expect(names).toContain('undoLastResult');
      expect(names).toContain('initializeProgram');
      expect(names).toContain('scheduleNextWorkout');
    });

    it('should unregister all tools by name on unmount', () => {
      installMockModelContext();
      const opts = buildOptions();
      const { unmount } = renderHook(() => useWebMcp(opts));

      unmount();

      expect(mockUnregisterTool).toHaveBeenCalledTimes(8);
      expect(mockUnregisterTool).toHaveBeenCalledWith('getCurrentWorkout');
      expect(mockUnregisterTool).toHaveBeenCalledWith('getProgram');
      expect(mockUnregisterTool).toHaveBeenCalledWith('getStats');
      expect(mockUnregisterTool).toHaveBeenCalledWith('getProgress');
      expect(mockUnregisterTool).toHaveBeenCalledWith('logResult');
      expect(mockUnregisterTool).toHaveBeenCalledWith('undoLastResult');
      expect(mockUnregisterTool).toHaveBeenCalledWith('initializeProgram');
      expect(mockUnregisterTool).toHaveBeenCalledWith('scheduleNextWorkout');
    });

    it('should mark read-only tools with readOnlyHint annotation', () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const readTools = [
        'getCurrentWorkout',
        'getProgram',
        'getStats',
        'getProgress',
        'scheduleNextWorkout',
      ];
      for (const name of readTools) {
        const tool = findTool(name);
        expect(tool.annotations?.readOnlyHint).toBe(true);
      }
    });

    it('should not mark write tools with readOnlyHint annotation', () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const writeTools = ['logResult', 'undoLastResult', 'initializeProgram'];
      for (const name of writeTools) {
        const tool = findTool(name);
        expect(tool.annotations?.readOnlyHint).toBeUndefined();
      }
    });
  });

  describe('MCP response format', () => {
    it('should return content array with text type', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgress').execute({}, {});

      expect(resp.content).toHaveLength(1);
      expect(resp.content[0].type).toBe('text');
      expect(typeof resp.content[0].text).toBe('string');
    });
  });

  describe('getCurrentWorkout', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getCurrentWorkout').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return the first incomplete workout', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getCurrentWorkout').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.index).toBe(0);
      expect(data.dayName).toBe('Día 1');
    });

    it('should return completed message when all workouts are done', async () => {
      installMockModelContext();
      const results = buildGenericSuccessResults(90);
      const opts = buildOptions({ results });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getCurrentWorkout').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.completed).toBe(true);
    });
  });

  describe('getProgram', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgram').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return all 90 rows by default', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgram').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(parsed).toHaveLength(90);
    });

    it('should return a range when startIndex and endIndex are provided', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgram').execute({ startIndex: 0, endIndex: 2 }, {});
      const { parsed } = parseResponse(resp);

      expect(parsed).toHaveLength(3);
    });

    it('should return error for invalid startIndex', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgram').execute({ startIndex: -1 }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('startIndex');
      }
    });

    it('should return error when startIndex > endIndex', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgram').execute({ startIndex: 5, endIndex: 2 }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('startIndex must be <= endIndex');
      }
    });
  });

  describe('getStats', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getStats').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return stats for all T1 exercises when no exercise specified', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getStats').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data).toHaveProperty('squat');
      expect(data).toHaveProperty('bench');
      expect(data).toHaveProperty('deadlift');
      expect(data).toHaveProperty('ohp');
    });

    it('should return stats for a single exercise', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getStats').execute({ exercise: 'squat' }, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data).toHaveProperty('squat');
      expect(data).not.toHaveProperty('bench');
    });

    it('should return error for invalid exercise', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getStats').execute({ exercise: 'curl' }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('Invalid exercise');
      }
    });
  });

  describe('getProgress', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgress').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return correct progress for a fresh program', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('getProgress').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.total).toBe(90);
      expect(data.completed).toBe(0);
      expect(data.percentage).toBe(0);
      expect(data.nextWorkoutIndex).toBe(0);
    });
  });

  describe('logResult', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'd1-t1', result: 'success' },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should call markResult with validated input', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'd1-t1', result: 'success' },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(false);
      expect(opts.markResult).toHaveBeenCalledWith(0, 'd1-t1', 'success');
    });

    it('should call setAmrapReps when amrapReps is provided for an AMRAP slot', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      // T3 is the only AMRAP slot in GZCLP
      await findTool('logResult').execute(
        { index: 0, slotId: 'latpulldown-t3', result: 'success', amrapReps: 25 },
        {}
      );

      expect(opts.setAmrapReps).toHaveBeenCalledWith(0, 'latpulldown-t3', 25);
    });

    it('should return error for invalid slotId', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'invalid-slot', result: 'success' },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('slotId');
      }
    });

    it('should return error for invalid result value', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'd1-t1', result: 'maybe' },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('result');
      }
    });

    it('should return error for out-of-range index', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 90, slotId: 'd1-t1', result: 'success' },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('index');
      }
    });

    it('should return error for non-object input', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute('not an object', {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return error for invalid amrapReps', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'd1-t1', result: 'success', amrapReps: -1 },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('amrapReps');
      }
    });

    it('should return error for amrapReps on non-AMRAP slot', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('logResult').execute(
        { index: 0, slotId: 'd1-t2', result: 'success', amrapReps: 10 },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('not an AMRAP slot');
      }
    });
  });

  describe('undoLastResult', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('undoLastResult').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should call undoLast', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('undoLastResult').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.undone).toBe(true);
      expect(opts.undoLast).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleNextWorkout', () => {
    it('should return error when no program initialized', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({}, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });

    it('should return a valid Google Calendar URL for the next workout', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute(
        { date: '2026-02-15', startHour: 7, durationMinutes: 60 },
        {}
      );
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(typeof data.calendarUrl).toBe('string');
      expect(
        (data.calendarUrl as string).startsWith(
          'https://calendar.google.com/calendar/render?action=TEMPLATE'
        )
      ).toBe(true);
    });

    it('should include correct exercise names in the title', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ date: '2026-02-15' }, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.title).toBe('GZCLP Día 1 — Sentadilla / Press Banca / Jalón al Pecho');
    });

    it('should format date range correctly in the URL', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute(
        { date: '2026-02-15', startHour: 18, durationMinutes: 90 },
        {}
      );
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;
      const url = data.calendarUrl as string;

      expect(url).toContain('dates=20260215T180000/20260215T193000');
      expect(data.startTime).toBe('18:00');
      expect(data.endTime).toBe('19:30');
    });

    it('should accept custom workoutIndex', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute(
        { workoutIndex: 1, date: '2026-02-16' },
        {}
      );
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.workoutIndex).toBe(1);
      expect(data.title).toBe('GZCLP Día 2 — Press Militar / Peso Muerto / Remo con Mancuernas');
    });

    it('should use defaults when no input is provided', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({}, {});
      const { parsed } = parseResponse(resp);
      const data = parsed as Record<string, unknown>;

      expect(data.workoutIndex).toBe(0);
      expect(data.startTime).toBe('07:00');
      expect(data.endTime).toBe('08:00');
    });

    it('should return error for invalid workoutIndex', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ workoutIndex: 90 }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('workoutIndex');
      }
    });

    it('should return error for invalid date string', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ date: 'not-a-date' }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('date');
      }
    });

    it('should return error for invalid startHour', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ startHour: 25 }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('startHour');
      }
    });

    it('should return error for invalid durationMinutes', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ durationMinutes: 0 }, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('durationMinutes');
      }
    });

    it('should include workout details in the calendar URL', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('scheduleNextWorkout').execute({ date: '2026-02-15' }, {});
      const { parsed } = parseResponse(resp);
      const url = (parsed as Record<string, unknown>).calendarUrl as string;

      expect(url).toContain('details=');
      const detailsParam = decodeURIComponent(url.split('details=')[1] as string);
      expect(detailsParam).toContain('T1: Sentadilla');
      expect(detailsParam).toContain('T2: Press Banca');
      expect(detailsParam).toContain('T3: Jalón al Pecho');
      expect(detailsParam).toContain('60kg');
    });

    it('should have readOnlyHint annotation', () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const tool = findTool('scheduleNextWorkout');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });
  });

  describe('initializeProgram', () => {
    it('should return error when program already exists', async () => {
      installMockModelContext();
      const opts = buildOptions();
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('initializeProgram').execute(CONFIG, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('already initialized');
      }
    });

    it('should call generateProgram with valid weights', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('initializeProgram').execute(CONFIG, {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(false);
      expect(opts.generateProgram).toHaveBeenCalledWith(CONFIG);
    });

    it('should return error for missing weight field', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('initializeProgram').execute(
        {
          squat: 60,
          bench: 40,
          deadlift: 80,
          ohp: 25,
          latpulldown: 30,
          // missing dbrow
        },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('dbrow');
      }
    });

    it('should return error for weight below minimum', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('initializeProgram').execute(
        { squat: 1, bench: 40, deadlift: 80, ohp: 25, latpulldown: 30, dbrow: 15 },
        {}
      );
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
      if (isErrorResponse(parsed)) {
        expect(parsed.error).toContain('squat');
      }
    });

    it('should return error for non-object input', async () => {
      installMockModelContext();
      const opts = buildOptions({ config: null });
      renderHook(() => useWebMcp(opts));

      const resp = await findTool('initializeProgram').execute('not an object', {});
      const { parsed } = parseResponse(resp);

      expect(isErrorResponse(parsed)).toBe(true);
    });
  });
});
