/**
 * Pure derivations for the lg+ Home dashboard (artboard 01 "Centro de mando").
 * They only read the computed workout rows the rest of Home already uses, so the
 * desktop view can never disagree with the tracker or the phone dashboard.
 */
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/domain/types';
import { findFirstPendingIndex, isWorkoutComplete } from '@gzclp/domain/generic-stats';
import { formatChartDate } from '@/components/charts/chart-theme';
import { restSecondsForRole } from '@/features/tracker/rest-timer-policy';

/** One T1/T2/T3 line of "Sesión de hoy". */
export interface TodaySlot {
  readonly id: string;
  readonly tier: string;
  readonly name: string;
  readonly scheme: string;
  readonly weight: number;
  readonly restSeconds: number;
}

/** "5×3+" — the working prescription, with the AMRAP marker when it applies. */
export function slotScheme(slot: Pick<GenericSlotRow, 'sets' | 'reps' | 'isAmrap'>): string {
  return `${slot.sets}×${slot.reps}${slot.isAmrap ? '+' : ''}`;
}

/** "3:00" for 180 seconds. */
export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * The next pending day's slots, one per exercise, in program order. Empty once
 * every workout is logged, so the card falls back to the completion state.
 */
export function buildTodaySlots(row: GenericWorkoutRow | undefined): readonly TodaySlot[] {
  if (row === undefined) return [];
  const seen = new Set<string>();
  const slots: TodaySlot[] = [];
  for (const slot of row.slots) {
    if (seen.has(slot.slotId)) continue;
    seen.add(slot.slotId);
    slots.push({
      id: slot.slotId,
      tier: slot.tier,
      name: slot.exerciseName,
      scheme: slotScheme(slot),
      weight: slot.weight,
      restSeconds: restSecondsForRole(slot.role),
    });
  }
  return slots;
}

export type WeekDayState = 'done' | 'today' | 'idle';

export interface WeekStripDay {
  /** Local y-m-d, used as the React key. */
  readonly key: string;
  readonly label: string;
  readonly state: WeekDayState;
}

export interface WeekStrip {
  readonly days: readonly WeekStripDay[];
  readonly doneThisWeek: number;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Monday-to-Sunday strip around `now`: completed days, today, and the rest
 * neutral. The app has no training-day schedule, so nothing is marked as
 * "planned" (decision L3).
 */
export function buildWeekStrip(
  completedDates: readonly string[],
  now: Date,
  lang: string
): WeekStrip {
  const today = startOfDay(now);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const completedDays = new Set<string>();
  let doneThisWeek = 0;
  for (const iso of completedDates) {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) continue;
    const date = startOfDay(parsed);
    if (date < monday || date > sunday) continue;
    doneThisWeek += 1;
    completedDays.add(dayKey(date));
  }

  const todayKey = dayKey(today);
  const weekdayFormat = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
  const days: WeekStripDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    const key = dayKey(date);
    days.push({
      key,
      label: weekdayFormat.format(date),
      state: completedDays.has(key) ? 'done' : key === todayKey ? 'today' : 'idle',
    });
  }
  return { days, doneThisWeek };
}

export interface LiftLoad {
  readonly id: string;
  readonly lift: string;
  /** Prescribed weight at the next session (or the last one when finished). */
  readonly weight: number;
  /** Progression up to that session, oldest first. */
  readonly series: readonly number[];
}

/**
 * The main lifts (role "primary") with their weight series up to the current
 * day. Future rows are excluded on purpose: Home must not leak the prescription
 * of sessions the lifter has not reached.
 */
export function buildT1Loads(rows: readonly GenericWorkoutRow[], limit = 4): readonly LiftLoad[] {
  const pending = findFirstPendingIndex(rows);
  const lastVisible = pending < 0 ? rows.length - 1 : pending;
  const order: string[] = [];
  const names = new Map<string, string>();
  const series = new Map<string, number[]>();

  for (let index = 0; index <= lastVisible; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    for (const slot of row.slots) {
      if (slot.role !== 'primary' || slot.weight <= 0) continue;
      if (!names.has(slot.exerciseId)) {
        names.set(slot.exerciseId, slot.exerciseName);
        order.push(slot.exerciseId);
      }
      const points = series.get(slot.exerciseId) ?? [];
      points.push(slot.weight);
      series.set(slot.exerciseId, points);
    }
  }

  return order.slice(0, limit).map((id) => {
    const points = series.get(id) ?? [];
    return {
      id,
      lift: names.get(id) ?? id,
      weight: points.at(-1) ?? 0,
      series: points,
    };
  });
}

export interface StageWarning {
  readonly lift: string;
  /** The new stage prescription, e.g. "6×2+". */
  readonly scheme: string;
  /** 1-based day of the failure that triggered the change. */
  readonly day: number;
}

/**
 * The most recent primary lift that changed stage after a failed day: the engine
 * advanced it (for example 5×3+ to 6×2+) instead of deloading it.
 */
export function buildStageWarning(rows: readonly GenericWorkoutRow[]): StageWarning | null {
  let warning: StageWarning | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    for (const slot of row.slots) {
      if (slot.role !== 'primary' || slot.result !== 'fail') continue;
      let next: GenericSlotRow | undefined;
      for (let later = index + 1; later < rows.length && next === undefined; later += 1) {
        next = rows[later]?.slots.find((candidate) => candidate.exerciseId === slot.exerciseId);
      }
      if (next === undefined || next.stage === slot.stage) continue;
      warning = { lift: slot.exerciseName, scheme: slotScheme(next), day: row.index + 1 };
    }
  }

  return warning;
}

export interface LastSessionSlot {
  readonly id: string;
  readonly tier: string;
  readonly name: string;
  readonly weight: number;
  readonly reps: number;
}

export interface LastSession {
  readonly day: number;
  readonly dayName: string;
  readonly dateLabel: string;
  readonly slots: readonly LastSessionSlot[];
}

/** The most recent completed workout with its logged numbers, for the right rail. */
export function buildLastSession(
  rows: readonly GenericWorkoutRow[],
  resultTimestamps: Readonly<Record<string, string>>
): LastSession | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row === undefined || !isWorkoutComplete(row)) continue;
    const timestamp = resultTimestamps[String(row.index)];
    return {
      day: row.index + 1,
      dayName: row.dayName,
      dateLabel: timestamp ? formatChartDate(timestamp) : '',
      slots: row.slots.map((slot) => ({
        id: slot.slotId,
        tier: slot.tier,
        name: slot.exerciseName,
        weight: slot.weight,
        reps: slot.amrapReps ?? slot.reps,
      })),
    };
  }
  return null;
}
