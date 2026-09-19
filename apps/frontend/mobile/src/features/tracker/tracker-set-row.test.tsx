import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoggedSetRow, TrackerSetRow } from './tracker-set-row';

describe('LoggedSetRow', () => {
  it('marks a set below the prescribed reps as a miss instead of a green check', () => {
    render(
      <LoggedSetRow index={3} entry={{ reps: 0, weight: 60 }} fallbackWeight={60} targetReps={5} />
    );
    expect(screen.getByLabelText('Set 3: 0 reps at 60 kg, below target')).toBeTruthy();
    expect(screen.getByText('✗')).toBeTruthy();
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('keeps the check for a set that meets the prescription', () => {
    render(
      <LoggedSetRow index={1} entry={{ reps: 5, weight: 60 }} fallbackWeight={60} targetReps={5} />
    );
    expect(screen.getByLabelText('Set 1: 5 reps at 60 kg')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('keeps the check when no target is known', () => {
    render(<LoggedSetRow index={1} entry={{ reps: 0 }} fallbackWeight={60} />);
    expect(screen.getByText('✓')).toBeTruthy();
  });
});

it('refreshes untouched prescriptions while preserving edits before confirmation', async () => {
  const onConfirm = jest.fn(async () => undefined);
  const { rerender } = render(
    <TrackerSetRow exerciseName="Squat" index={1} weight={60} reps={5} onConfirm={onConfirm} />
  );
  rerender(
    <TrackerSetRow exerciseName="Squat" index={1} weight={65} reps={3} onConfirm={onConfirm} />
  );
  expect(screen.getByLabelText('Weight for set 1 of Squat').props.value).toBe('65');
  expect(screen.getByLabelText('Reps for set 1 of Squat').props.value).toBe('3');
  fireEvent.changeText(screen.getByLabelText('Weight for set 1 of Squat'), '62.5');
  rerender(
    <TrackerSetRow exerciseName="Squat" index={1} weight={70} reps={4} onConfirm={onConfirm} />
  );
  fireEvent.press(screen.getByRole('button', { name: 'Confirm set 1 for Squat' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ weight: 62.5, reps: 4 }));
});
