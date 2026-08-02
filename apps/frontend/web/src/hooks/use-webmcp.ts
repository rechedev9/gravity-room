import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultValue, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { extractGenericChartData, calculateStats } from '@gzclp/domain/generic-stats';
import { isRecord } from '@gzclp/domain/type-guards';
import { buildGoogleCalendarUrl } from '@/lib/calendar';

interface UseWebMcpOptions {
  readonly enabled: boolean;
  readonly config: Record<string, number | string> | null;
  readonly rows: readonly GenericWorkoutRow[];
  readonly definition?: ProgramDefinition;
  readonly totalWorkouts: number;
  readonly generateProgram: (config: Record<string, number | string>) => void;
  readonly markResult: (index: number, slotId: string, value: ResultValue) => void;
  readonly setAmrapReps: (index: number, slotId: string, reps: number | undefined) => void;
  readonly undoLast: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResponse(data: unknown): ModelContextToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function errorResponse(error: string): ModelContextToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ error }) }] };
}

function findNextIncomplete(rows: readonly GenericWorkoutRow[]): GenericWorkoutRow | undefined {
  return rows.find((r) => r.slots.some((s) => s.result === undefined));
}

function isResultValue(value: unknown): value is ResultValue {
  return value === 'success' || value === 'fail';
}

function isValidIndex(value: unknown, totalWorkouts: number): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < totalWorkouts
  );
}

function isToolResponse(value: unknown): value is ModelContextToolResponse {
  if (!isRecord(value) || !Array.isArray(value.content)) return false;
  return value.content.every(
    (block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string'
  );
}

async function requireUserInteraction(
  client: ModelContextClient,
  action: () => Promise<ModelContextToolResponse>
): Promise<ModelContextToolResponse> {
  try {
    const response = await client.requestUserInteraction(action);
    return isToolResponse(response)
      ? response
      : errorResponse('The browser did not authorize this tool interaction.');
  } catch {
    return errorResponse('The user declined this tool interaction.');
  }
}

/** Derive T1 exercise IDs from the definition. */
function deriveT1Exercises(definition: ProgramDefinition): readonly string[] {
  const ids = new Set<string>();
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (slot.tier === 't1') ids.add(slot.exerciseId);
    }
  }
  return [...ids];
}

const NO_PROGRAM = 'No program initialized. Use initializeProgram first.';
const ACCESS_DISABLED = 'AI assistant access is disabled for this session.';

// ---------------------------------------------------------------------------
// Tool name constants (used for registerTool / unregisterTool)
// ---------------------------------------------------------------------------

const TOOL_NAMES = [
  'getCurrentWorkout',
  'getProgram',
  'getStats',
  'getProgress',
  'logResult',
  'undoLastResult',
  'initializeProgram',
  'scheduleNextWorkout',
] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebMcp(options: UseWebMcpOptions): void {
  const { t } = useTranslation();
  const stateRef = useRef(options);

  // Ref-sync effect: intentionally has no dependency array so it runs after every render.
  // Must be declared before the registration effect to guarantee execution order.
  useEffect(() => {
    stateRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled || typeof navigator === 'undefined' || !navigator.modelContext) {
      return;
    }

    const mc = navigator.modelContext;

    // --- Read-only tools ---

    mc.registerTool({
      name: 'getCurrentWorkout',
      description:
        'Get the next incomplete workout. Returns the workout details including exercises, weights, sets, reps, and any partial results.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        if (!stateRef.current.enabled) return errorResponse(ACCESS_DISABLED);
        if (!isRecord(input)) return errorResponse('Input must be an object.');
        if (!stateRef.current.config) return errorResponse(NO_PROGRAM);
        return requireUserInteraction(client, async () => {
          const current = findNextIncomplete(stateRef.current.rows);
          if (!current) {
            return textResponse({ message: 'All workouts completed!', completed: true });
          }
          return textResponse({
            index: current.index,
            dayName: current.dayName,
            slots: current.slots.map((s) => ({
              slotId: s.slotId,
              exercise: s.exerciseName,
              tier: s.tier.toUpperCase(),
              weight: s.weight,
              sets: s.sets,
              reps: s.reps,
              stage: s.stage + 1,
              isAmrap: s.isAmrap,
              result: s.result ?? null,
            })),
          });
        });
      },
    });

    mc.registerTool({
      name: 'getProgram',
      description:
        'Get workout rows from the program. Optionally pass startIndex and endIndex to get a range. Returns all rows by default.',
      inputSchema: {
        type: 'object',
        properties: {
          startIndex: { type: 'number', description: 'First workout index, default 0' },
          endIndex: { type: 'number', description: 'Last workout index' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        const { enabled, config, totalWorkouts: tw } = stateRef.current;
        if (!enabled) return errorResponse(ACCESS_DISABLED);
        if (!config) return errorResponse(NO_PROGRAM);
        if (!isRecord(input)) return errorResponse('Input must be an object.');
        let start = 0;
        let end = tw - 1;
        if (input.startIndex !== undefined) {
          if (!isValidIndex(input.startIndex, tw)) {
            return errorResponse(`startIndex must be an integer between 0 and ${tw - 1}.`);
          }
          start = input.startIndex;
        }
        if (input.endIndex !== undefined) {
          if (!isValidIndex(input.endIndex, tw)) {
            return errorResponse(`endIndex must be an integer between 0 and ${tw - 1}.`);
          }
          end = input.endIndex;
        }
        if (start > end) return errorResponse('startIndex must be <= endIndex.');

        return requireUserInteraction(client, async () => {
          const slice = stateRef.current.rows.slice(start, end + 1).map((r) => ({
            index: r.index,
            dayName: r.dayName,
            slots: r.slots.map((s) => ({
              slotId: s.slotId,
              exercise: s.exerciseName,
              tier: s.tier.toUpperCase(),
              weight: s.weight,
              stage: s.stage + 1,
            })),
            completed: r.slots.every((s) => s.result !== undefined),
          }));
          return textResponse(slice);
        });
      },
    });

    mc.registerTool({
      name: 'getStats',
      description:
        'Get performance statistics for one or all primary (T1) exercises. Includes success rate, current weight, weight gained, and current stage.',
      inputSchema: {
        type: 'object',
        properties: {
          exercise: {
            type: 'string',
            description: 'Exercise ID (e.g. squat, bench). Omit for all T1 exercises.',
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        const { enabled, config, definition: def } = stateRef.current;
        if (!enabled) return errorResponse(ACCESS_DISABLED);
        if (!config) return errorResponse(NO_PROGRAM);
        if (!def) return errorResponse('Program definition not loaded yet.');
        if (!isRecord(input)) return errorResponse('Input must be an object.');
        const t1Exercises = deriveT1Exercises(def);
        let requestedExercise: string | undefined;
        if (input.exercise !== undefined) {
          if (typeof input.exercise !== 'string')
            return errorResponse('exercise must be a string.');
          requestedExercise = input.exercise.toLowerCase();
          if (!new Set(t1Exercises).has(requestedExercise)) {
            return errorResponse(`Invalid exercise. Must be one of: ${t1Exercises.join(', ')}`);
          }
        }

        return requireUserInteraction(client, async () => {
          const chartData = extractGenericChartData(def, stateRef.current.rows);
          if (requestedExercise !== undefined) {
            const points = chartData[requestedExercise];
            return points
              ? textResponse({ [requestedExercise]: calculateStats(points) })
              : errorResponse(`No data found for exercise: ${requestedExercise}`);
          }
          const allStats: Record<string, ReturnType<typeof calculateStats>> = {};
          for (const exercise of t1Exercises) {
            const points = chartData[exercise];
            if (points) allStats[exercise] = calculateStats(points);
          }
          return textResponse(allStats);
        });
      },
    });

    mc.registerTool({
      name: 'getProgress',
      description:
        'Get overall program progress: total workouts, completed count, percentage, and next workout index.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        if (!stateRef.current.enabled) return errorResponse(ACCESS_DISABLED);
        if (!isRecord(input)) return errorResponse('Input must be an object.');
        if (!stateRef.current.config) return errorResponse(NO_PROGRAM);
        return requireUserInteraction(client, async () => {
          const { rows, totalWorkouts: tw } = stateRef.current;
          const completed = rows.filter((r) => r.slots.every((s) => s.result !== undefined)).length;
          const next = findNextIncomplete(rows);
          return textResponse({
            total: tw,
            completed,
            percentage: tw > 0 ? Math.round((completed / tw) * 100) : 0,
            nextWorkoutIndex: next ? next.index : null,
          });
        });
      },
    });

    // --- Write tools ---

    mc.registerTool({
      name: 'logResult',
      description:
        'Log a success or fail result for a slot at a specific workout index. Optionally set AMRAP reps for AMRAP slots.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'Workout index' },
          slotId: { type: 'string', description: 'Slot ID (e.g. d1-t1, latpulldown-t3)' },
          result: { type: 'string', description: 'Result: success or fail' },
          amrapReps: {
            type: 'number',
            description: 'Optional AMRAP reps for AMRAP slots (0-999)',
          },
        },
        required: ['index', 'slotId', 'result'],
      },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        if (!stateRef.current.enabled) return errorResponse(ACCESS_DISABLED);
        if (!stateRef.current.config) return errorResponse(NO_PROGRAM);
        if (!isRecord(input)) {
          return errorResponse('Input must be an object with index, slotId, and result.');
        }
        const { index, slotId, result, amrapReps } = input;
        const tw = stateRef.current.totalWorkouts;
        if (!isValidIndex(index, tw)) {
          return errorResponse(`index must be an integer between 0 and ${tw - 1}.`);
        }
        if (typeof slotId !== 'string') {
          return errorResponse('slotId must be a string.');
        }
        const row = stateRef.current.rows[index];
        if (!row) {
          return errorResponse(`No workout found at index ${index}.`);
        }
        const slot = row.slots.find((s) => s.slotId === slotId);
        if (!slot) {
          const validSlots = row.slots.map((s) => s.slotId).join(', ');
          return errorResponse(`Invalid slotId. Must be one of: ${validSlots}`);
        }
        if (!isResultValue(result)) {
          return errorResponse('result must be "success" or "fail".');
        }
        if (amrapReps !== undefined) {
          if (
            typeof amrapReps !== 'number' ||
            !Number.isInteger(amrapReps) ||
            amrapReps < 0 ||
            amrapReps > 999
          ) {
            return errorResponse('amrapReps must be an integer between 0 and 999.');
          }
          if (!slot.isAmrap) return errorResponse(`Slot ${slotId} is not an AMRAP slot.`);
        }

        return requireUserInteraction(client, async () => {
          stateRef.current.markResult(index, slotId, result);
          if (amrapReps !== undefined) {
            stateRef.current.setAmrapReps(index, slotId, amrapReps);
          }
          return textResponse({ logged: { index, slotId, result, amrapReps: amrapReps ?? null } });
        });
      },
    });

    mc.registerTool({
      name: 'undoLastResult',
      description: 'Undo the most recent result change.',
      inputSchema: { type: 'object', properties: {} },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        if (!stateRef.current.enabled) return errorResponse(ACCESS_DISABLED);
        if (!isRecord(input)) return errorResponse('Input must be an object.');
        if (!stateRef.current.config) return errorResponse(NO_PROGRAM);
        return requireUserInteraction(client, async () => {
          stateRef.current.undoLast();
          return textResponse({ undone: true });
        });
      },
    });

    mc.registerTool({
      name: 'initializeProgram',
      description:
        'Initialize the program with starting weights. The required fields depend on the program definition.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        if (!stateRef.current.enabled) return errorResponse(ACCESS_DISABLED);
        if (stateRef.current.config) {
          return errorResponse('Program already initialized. Cannot re-initialize.');
        }
        const def = stateRef.current.definition;
        if (!def) {
          return errorResponse('Program definition not loaded yet.');
        }
        if (!isRecord(input)) {
          return errorResponse(
            `Input must be an object with: ${def.configFields.map((f) => f.key).join(', ')}.`
          );
        }
        const validated: Record<string, number | string> = {};
        for (const field of def.configFields) {
          const val = input[field.key];
          if (field.type === 'weight') {
            if (typeof val !== 'number' || !Number.isFinite(val) || val < field.min) {
              return errorResponse(`${field.key} must be a number >= ${field.min}.`);
            }
            validated[field.key] = val;
          } else {
            if (typeof val !== 'string' || !field.options.some((option) => option.value === val)) {
              return errorResponse(
                `${field.key} must be one of: ${field.options.map((option) => option.value).join(', ')}.`
              );
            }
            validated[field.key] = val;
          }
        }
        return requireUserInteraction(client, async () => {
          stateRef.current.generateProgram(validated);
          return textResponse({ initialized: true, weights: validated });
        });
      },
    });

    mc.registerTool({
      name: 'scheduleNextWorkout',
      description:
        'Generate a Google Calendar URL to schedule a workout. Opens a pre-filled event creation page.',
      inputSchema: {
        type: 'object',
        properties: {
          workoutIndex: {
            type: 'number',
            description: 'Workout index. Defaults to the next incomplete workout.',
          },
          date: {
            type: 'string',
            description: 'ISO date string (e.g. "2026-02-15"). Defaults to tomorrow.',
          },
          startHour: {
            type: 'number',
            description: 'Start hour 0-23. Defaults to 7.',
          },
          durationMinutes: {
            type: 'number',
            description: 'Duration in minutes (1-480). Defaults to 60.',
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (
        input: unknown,
        client: ModelContextClient
      ): Promise<ModelContextToolResponse> => {
        const { enabled, rows, config, totalWorkouts: tw, definition: def } = stateRef.current;
        if (!enabled) return errorResponse(ACCESS_DISABLED);
        if (!config) return errorResponse(NO_PROGRAM);
        if (!def) return errorResponse('Program definition not loaded yet.');
        if (!isRecord(input)) return errorResponse('Input must be an object.');

        let workoutIndex: number | undefined;
        let date: string | undefined;
        let startHour: number | undefined;
        let durationMinutes: number | undefined;

        if (input.workoutIndex !== undefined) {
          if (!isValidIndex(input.workoutIndex, tw)) {
            return errorResponse(`workoutIndex must be an integer between 0 and ${tw - 1}.`);
          }
          workoutIndex = input.workoutIndex;
        }
        if (input.date !== undefined) {
          if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
            return errorResponse('date must be a valid ISO date string (YYYY-MM-DD).');
          }
          const parsed = new Date(`${input.date}T00:00:00Z`);
          if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date) {
            return errorResponse('date must be a valid ISO date string (YYYY-MM-DD).');
          }
          date = input.date;
        }
        if (input.startHour !== undefined) {
          if (
            typeof input.startHour !== 'number' ||
            !Number.isInteger(input.startHour) ||
            input.startHour < 0 ||
            input.startHour > 23
          ) {
            return errorResponse('startHour must be an integer between 0 and 23.');
          }
          startHour = input.startHour;
        }
        if (input.durationMinutes !== undefined) {
          if (
            typeof input.durationMinutes !== 'number' ||
            !Number.isInteger(input.durationMinutes) ||
            input.durationMinutes < 1 ||
            input.durationMinutes > 480
          ) {
            return errorResponse('durationMinutes must be an integer between 1 and 480.');
          }
          durationMinutes = input.durationMinutes;
        }

        if (workoutIndex === undefined) {
          const next = findNextIncomplete(rows);
          if (!next) {
            return errorResponse('All workouts completed. No workout to schedule.');
          }
          workoutIndex = next.index;
        }

        const row = rows[workoutIndex];
        if (!row) {
          return errorResponse(`workoutIndex must be an integer between 0 and ${tw - 1}.`);
        }

        return requireUserInteraction(client, async () => {
          const event = buildGoogleCalendarUrl(row, def, { date, startHour, durationMinutes, t });
          return textResponse({
            calendarUrl: event.calendarUrl,
            title: event.title,
            workoutIndex,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
          });
        });
      },
    });

    return (): void => {
      stateRef.current = { ...stateRef.current, enabled: false };
      for (const name of TOOL_NAMES) {
        mc.unregisterTool(name);
      }
    };
  }, [options.enabled, t]);
}
