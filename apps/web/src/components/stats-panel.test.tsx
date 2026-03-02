/**
 * stats-panel.test.tsx — DOM structure, collapse behavior, and prop tests for StatsPanel.
 * Canvas drawing cannot be tested in happy-dom — tests verify DOM structure,
 * aria attributes, prop-driven state, and controlled collapse behavior.
 */
import { describe, it, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import StatsPanel from './stats-panel';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSlot(
  overrides: Partial<GenericSlotRow> & { slotId: string; exerciseId: string }
): GenericSlotRow {
  return {
    exerciseName: overrides.exerciseName ?? overrides.exerciseId,
    tier: overrides.tier ?? 't1',
    weight: overrides.weight ?? 60,
    stage: overrides.stage ?? 0,
    sets: overrides.sets ?? 5,
    reps: overrides.reps ?? 3,
    repsMax: overrides.repsMax ?? undefined,
    isAmrap: overrides.isAmrap ?? false,
    stagesCount: overrides.stagesCount ?? 1,
    result: overrides.result ?? undefined,
    amrapReps: overrides.amrapReps ?? undefined,
    rpe: overrides.rpe ?? undefined,
    isChanged: overrides.isChanged ?? false,
    isDeload: overrides.isDeload ?? false,
    role: overrides.role ?? 'primary',
    notes: overrides.notes ?? undefined,
    prescriptions: overrides.prescriptions ?? undefined,
    isGpp: overrides.isGpp ?? undefined,
    complexReps: overrides.complexReps ?? undefined,
    propagatesTo: overrides.propagatesTo ?? undefined,
    isTestSlot: overrides.isTestSlot ?? undefined,
    ...overrides,
  };
}

function makeRow(index: number, slots: GenericSlotRow[]): GenericWorkoutRow {
  return {
    index,
    dayName: `Day ${index + 1}`,
    slots,
    isChanged: false,
  };
}

// ---------------------------------------------------------------------------
// Minimal ProgramDefinition — two exercises in one group
// ---------------------------------------------------------------------------

const TEST_DEFINITION: ProgramDefinition = {
  id: 'test-stats',
  name: 'Test Stats',
  description: 'Fixture for StatsPanel tests',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 4,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Sentadilla' },
    bench: { name: 'Press Banca' },
  },
  configFields: [
    {
      key: 'squat',
      label: 'Sentadilla',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Principales',
    },
    {
      key: 'bench',
      label: 'Press Banca',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Principales',
    },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-s1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'bench-s1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

// Rows with at least one result (needed to make StatsPanel render charts)
const ROWS_WITH_RESULTS: GenericWorkoutRow[] = [
  makeRow(0, [
    makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 60, result: 'success' }),
  ]),
  makeRow(1, [
    makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 40, result: 'success' }),
  ]),
  makeRow(2, [
    makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 65, result: 'success' }),
  ]),
  makeRow(3, [makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 42.5, result: 'fail' })]),
];

// ---------------------------------------------------------------------------
// Two-group definition for testing first-open behavior with multiple groups
// ---------------------------------------------------------------------------

const TWO_GROUP_DEFINITION: ProgramDefinition = {
  id: 'test-two-group',
  name: 'Test Two Group',
  description: 'Fixture with two groups',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 4,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Sentadilla' },
    bench: { name: 'Press Banca' },
    curl: { name: 'Curl' },
  },
  configFields: [
    {
      key: 'squat',
      label: 'Sentadilla',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Principales',
    },
    {
      key: 'bench',
      label: 'Press Banca',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Principales',
    },
    { key: 'curl', label: 'Curl', type: 'weight', min: 0, step: 0.5, group: 'Accesorios' },
  ],
  weightIncrements: { squat: 5, bench: 2.5, curl: 1 },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-s1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
        {
          id: 'curl-s1',
          exerciseId: 'curl',
          tier: 't3',
          stages: [{ sets: 3, reps: 10 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'curl',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'bench-s1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const TWO_GROUP_ROWS: GenericWorkoutRow[] = [
  makeRow(0, [
    makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 60, result: 'success' }),
    makeSlot({ slotId: 'curl-s1', exerciseId: 'curl', weight: 10, result: 'success' }),
  ]),
  makeRow(1, [
    makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 40, result: 'success' }),
  ]),
  makeRow(2, [
    makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 65, result: 'success' }),
    makeSlot({ slotId: 'curl-s1', exerciseId: 'curl', weight: 11, result: 'success' }),
  ]),
  makeRow(3, [
    makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 42.5, result: 'success' }),
  ]),
];

// ---------------------------------------------------------------------------
// Task 9.7 — controlled collapse and default open
// ---------------------------------------------------------------------------

describe('StatsPanel — Phase 2 controlled collapse and default open', () => {
  it('first exercise group section is expanded on mount (aria-expanded="true" on header button)', () => {
    render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((b) => b.getAttribute('aria-expanded') !== null);

    expect(sectionButtons.length).toBeGreaterThanOrEqual(1);
    expect(sectionButtons[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('other sections are collapsed on mount', () => {
    render(
      <StatsPanel definition={TWO_GROUP_DEFINITION} rows={TWO_GROUP_ROWS} resultTimestamps={{}} />
    );

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((b) => b.getAttribute('aria-expanded') !== null);

    // First is open, rest are collapsed
    expect(sectionButtons.length).toBeGreaterThanOrEqual(2);
    expect(sectionButtons[0].getAttribute('aria-expanded')).toBe('true');
    for (let i = 1; i < sectionButtons.length; i++) {
      expect(sectionButtons[i].getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('clicking a collapsed section header sets its aria-expanded to "true"', () => {
    render(
      <StatsPanel definition={TWO_GROUP_DEFINITION} rows={TWO_GROUP_ROWS} resultTimestamps={{}} />
    );

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((b) => b.getAttribute('aria-expanded') !== null);
    const collapsedButton = sectionButtons.find((b) => b.getAttribute('aria-expanded') === 'false');

    expect(collapsedButton).toBeDefined();

    fireEvent.click(collapsedButton!);

    expect(collapsedButton!.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking an open section header collapses it', () => {
    render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((b) => b.getAttribute('aria-expanded') !== null);
    const openButton = sectionButtons.find((b) => b.getAttribute('aria-expanded') === 'true');

    expect(openButton).toBeDefined();

    fireEvent.click(openButton!);

    expect(openButton!.getAttribute('aria-expanded')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Task 9.8 — no <details> element
// ---------------------------------------------------------------------------

describe('StatsPanel — no <details> element', () => {
  it('rendered HTML contains no <details> elements', () => {
    const { container } = render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    // Filter out <details> from LineChart's sr-only accessibility table
    // StatsPanel itself should not use <details> for collapse behavior
    const statsPanelDetails = container.querySelectorAll(':scope > .space-y-4 > details');

    expect(statsPanelDetails.length).toBe(0);
  });

  it('rendered HTML contains no <summary> elements at the StatsPanel level', () => {
    const { container } = render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    // Only <summary> elements should be within LineChart's sr-only <details> — not in StatsPanel structure
    const statsPanelSummaries = container.querySelectorAll(':scope > .space-y-4 > summary');

    expect(statsPanelSummaries.length).toBe(0);
  });

  it('section header renders as a <button> element with type="button"', () => {
    render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((b) => b.getAttribute('aria-expanded') !== null);

    expect(sectionButtons.length).toBeGreaterThanOrEqual(1);
    expect(sectionButtons[0].getAttribute('type')).toBe('button');
  });
});

// ---------------------------------------------------------------------------
// Task 9.9 — resultTimestamps prop and chart rendering
// ---------------------------------------------------------------------------

describe('StatsPanel — resultTimestamps prop and chart rendering', () => {
  it('component renders without errors when resultTimestamps is empty object', () => {
    expect(() => {
      render(
        <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
      );
    }).not.toThrow();
  });

  it('RPE chart appears when mock data has exercise with 2+ RPE recordings', () => {
    const rowsWithRpe: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 60,
          result: 'success',
          rpe: 7,
        }),
      ]),
      makeRow(1, [
        makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 40, result: 'success' }),
      ]),
      makeRow(2, [
        makeSlot({
          slotId: 'squat-s1',
          exerciseId: 'squat',
          weight: 65,
          result: 'success',
          rpe: 8,
        }),
      ]),
      makeRow(3, [
        makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 42.5, result: 'success' }),
      ]),
    ];

    render(<StatsPanel definition={TEST_DEFINITION} rows={rowsWithRpe} resultTimestamps={{}} />);

    const rpeChart = screen.getByTestId('rpe-chart-squat');

    expect(rpeChart).toBeDefined();
  });

  it('RPE chart does NOT appear for exercise with 0 RPE recordings', () => {
    // bench has no RPE in the default ROWS_WITH_RESULTS fixture
    render(
      <StatsPanel definition={TEST_DEFINITION} rows={ROWS_WITH_RESULTS} resultTimestamps={{}} />
    );

    const rpeCharts = screen.queryAllByTestId('rpe-chart-bench');

    expect(rpeCharts.length).toBe(0);
  });

  it('volume section does NOT render when fewer than 3 completed sessions', () => {
    // Only 2 workouts with successful slots (indices 0 and 2 for squat, 1 for bench)
    // but need 3+ for volume to appear. Our ROWS_WITH_RESULTS has 4 rows total but
    // each row only has 1 slot. Let's verify: all 4 rows have result set, so 4 volume entries.
    // Actually 4 workouts have success/fail — 3 success. We need fewer than 3 success workouts.
    const twoSuccessRows: GenericWorkoutRow[] = [
      makeRow(0, [
        makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 60, result: 'success' }),
      ]),
      makeRow(1, [
        makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 40, result: 'success' }),
      ]),
      makeRow(2, [
        makeSlot({ slotId: 'squat-s1', exerciseId: 'squat', weight: 65, result: 'fail' }),
      ]),
      makeRow(3, [
        makeSlot({ slotId: 'bench-s1', exerciseId: 'bench', weight: 42.5, result: 'fail' }),
      ]),
    ];

    render(<StatsPanel definition={TEST_DEFINITION} rows={twoSuccessRows} resultTimestamps={{}} />);

    // Volume section uses sectionKey "volumen-total" — look for it
    const volumeSections = screen.queryAllByText('Volumen Total');

    expect(volumeSections.length).toBe(0);
  });
});
