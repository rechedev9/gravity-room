import { describe, it, expect, mock } from 'bun:test';
import { render } from '@testing-library/react';
import { ExerciseCard } from './exercise-card';
import type { ExerciseCardProps } from './exercise-card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProps(overrides?: Partial<ExerciseCardProps>): ExerciseCardProps {
  return {
    workoutIndex: 0,
    slotKey: 'slot-0',
    exerciseName: 'Sentadilla',
    tierLabel: 'T1',
    role: 'primary',
    weight: 60,
    scheme: '5\u00d73',
    stage: 0,
    showStage: false,
    isAmrap: false,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    showRpe: false,
    isChanged: false,
    isDeload: false,
    onMark: mock() as unknown as ExerciseCardProps['onMark'],
    onUndo: mock() as unknown as ExerciseCardProps['onUndo'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests (REQ-CCF-005, REQ-TIF-002, REQ-TIF-004)
// ---------------------------------------------------------------------------

describe('ExerciseCard', () => {
  describe('completed card opacity (REQ-TIF-002)', () => {
    it('should have opacity-55 class when result is defined', () => {
      const { container } = render(<ExerciseCard {...buildProps({ result: 'success' })} />);

      const card = container.firstElementChild;

      expect(card?.className).toContain('opacity-55');
    });

    it('should NOT have opacity-55 class when result is undefined', () => {
      const { container } = render(<ExerciseCard {...buildProps({ result: undefined })} />);

      const card = container.firstElementChild;

      expect(card?.className).not.toContain('opacity-55');
    });
  });

  describe('deload indicator (REQ-DI-003)', () => {
    it('shows Deload text when isDeload=true', () => {
      const { container } = render(<ExerciseCard {...buildProps({ isDeload: true })} />);

      expect(container.textContent).toContain('Deload');
    });

    it('does NOT show Deload text when isDeload=false', () => {
      const { container } = render(<ExerciseCard {...buildProps({ isDeload: false })} />);

      expect(container.textContent).not.toContain('Deload');
    });
  });

  describe('plate calculator button (REQ-PC-002, REQ-PC-003)', () => {
    it('renders plate calculator button for role=primary with weight > 0', () => {
      const { container } = render(
        <ExerciseCard {...buildProps({ role: 'primary', weight: 60 })} />
      );

      const btn = container.querySelector('button[aria-label="Calculadora de discos"]');

      expect(btn).not.toBeNull();
    });

    it('does NOT render plate calculator button for role=secondary', () => {
      const { container } = render(
        <ExerciseCard {...buildProps({ role: 'secondary', weight: 60 })} />
      );

      const btn = container.querySelector('button[aria-label="Calculadora de discos"]');

      expect(btn).toBeNull();
    });
  });

  describe('workout notes (REQ-WN-002)', () => {
    it('renders textarea with aria-label="Notas" when instanceId is defined', () => {
      const { container } = render(
        <ExerciseCard {...buildProps({ instanceId: 'test-instance' })} />
      );

      const textarea = container.querySelector('textarea[aria-label="Notas"]');

      expect(textarea).not.toBeNull();
    });

    it('does NOT render textarea when instanceId is undefined', () => {
      const { container } = render(<ExerciseCard {...buildProps({ instanceId: undefined })} />);

      const textarea = container.querySelector('textarea[aria-label="Notas"]');

      expect(textarea).toBeNull();
    });
  });

  describe('font sizes (REQ-TIF-004)', () => {
    it('should render tier label with text-[12px] class', () => {
      const { container } = render(<ExerciseCard {...buildProps()} />);

      const tierSpan = container.querySelector('.text-\\[12px\\]');

      expect(tierSpan).not.toBeNull();
      expect(tierSpan?.textContent).toBe('T1');
    });

    it('should render accessory weight with text-base class', () => {
      const { container } = render(
        <ExerciseCard {...buildProps({ role: 'accessory', weight: 30 })} />
      );

      const weightSpan = container.querySelector('.text-base');

      expect(weightSpan).not.toBeNull();
      expect(weightSpan?.textContent).toContain('30 kg');
    });
  });
});
