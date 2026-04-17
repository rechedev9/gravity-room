import { describe, it, expect } from 'bun:test';
import { buildGoogleCalendarUrl } from './calendar';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { DEFAULT_WEIGHTS, GZCLP_DEFINITION_FIXTURE } from '../../test/helpers/fixtures';

const DEF = GZCLP_DEFINITION_FIXTURE;
const CONFIG = DEFAULT_WEIGHTS as Record<string, number>;
const rows = computeGenericProgram(DEF, CONFIG, {});

describe('buildGoogleCalendarUrl', () => {
  describe('URL format', () => {
    it('returns a valid Google Calendar URL with correct base', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF, { date: '2026-03-01' });

      expect(result.calendarUrl).toStartWith(
        'https://calendar.google.com/calendar/render?action=TEMPLATE'
      );
    });

    it('includes encoded text, dates, and details params', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF, { date: '2026-03-01' });

      expect(result.calendarUrl).toContain('&text=');
      expect(result.calendarUrl).toContain('&dates=');
      expect(result.calendarUrl).toContain('&details=');
    });
  });

  describe('title', () => {
    it('contains the day name and all exercise names', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF, { date: '2026-03-01' });

      expect(result.title).toBe('GZCLP Día 1 — Sentadilla / Press Banca / Jalón al Pecho');
    });

    it('reflects the correct exercises for day 2', () => {
      const result = buildGoogleCalendarUrl(rows[1], DEF, { date: '2026-03-01' });

      expect(result.title).toBe('GZCLP Día 2 — Press Militar / Peso Muerto / Remo con Mancuernas');
    });
  });

  describe('description', () => {
    it('contains slot details with weights, sets×reps, and stages', () => {
      const { calendarUrl } = buildGoogleCalendarUrl(rows[0], DEF, { date: '2026-03-01' });
      const detailsParam = new URL(calendarUrl).searchParams.get('details') ?? '';

      expect(detailsParam).toContain('T1: Sentadilla');
      expect(detailsParam).toContain('60kg');
      expect(detailsParam).toContain('5×3');
      expect(detailsParam).toContain('Etapa 1');
      expect(detailsParam).toContain('T2: Press Banca');
      expect(detailsParam).toContain('T3: Jalón al Pecho');
      expect(detailsParam).toContain('3×25');
    });
  });

  describe('date and time', () => {
    it('formats date range correctly for custom inputs', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF, {
        date: '2026-06-15',
        startHour: 9,
        durationMinutes: 90,
      });

      expect(result.date).toBe('2026-06-15');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('10:30');
      expect(result.calendarUrl).toContain('20260615T090000/20260615T103000');
    });

    it('defaults to 07:00 start and 60 min duration', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF, { date: '2026-03-01' });

      expect(result.startTime).toBe('07:00');
      expect(result.endTime).toBe('08:00');
      expect(result.calendarUrl).toContain('20260301T070000/20260301T080000');
    });

    it('defaults to tomorrow when no date is provided', () => {
      const result = buildGoogleCalendarUrl(rows[0], DEF);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = tomorrow.toISOString().slice(0, 10);

      expect(result.date).toBe(expected);
    });
  });

  describe('stages', () => {
    it('handles a modified stage correctly in description', () => {
      const baseRow = rows[0];
      // Simulate T1 at stage 1 (6×2)
      const modifiedRow = {
        ...baseRow,
        slots: baseRow.slots.map((s, i) => (i === 0 ? { ...s, stage: 1, sets: 6, reps: 2 } : s)),
      };
      const { calendarUrl } = buildGoogleCalendarUrl(modifiedRow, DEF, { date: '2026-03-01' });
      const details = new URL(calendarUrl).searchParams.get('details') ?? '';

      expect(details).toContain('6×2');
      expect(details).toContain('Etapa 2');
    });

    it('handles a modified stage 2 correctly', () => {
      const baseRow = rows[0];
      // Simulate T1 at stage 2 (10×1)
      const modifiedRow = {
        ...baseRow,
        slots: baseRow.slots.map((s, i) => (i === 0 ? { ...s, stage: 2, sets: 10, reps: 1 } : s)),
      };
      const { calendarUrl } = buildGoogleCalendarUrl(modifiedRow, DEF, { date: '2026-03-01' });
      const details = new URL(calendarUrl).searchParams.get('details') ?? '';

      expect(details).toContain('10×1');
      expect(details).toContain('Etapa 3');
    });
  });
});
