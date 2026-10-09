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

it('logs bodyweight work by reps alone, with no weight field', async () => {
  const onConfirm = jest.fn(async () => undefined);
  render(
    <TrackerSetRow
      exerciseName="Plank"
      index={1}
      weight={82}
      reps={1}
      showWeight={false}
      onConfirm={onConfirm}
    />
  );
  expect(screen.queryByLabelText('Weight for set 1 of Plank')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Confirm set 1 for Plank' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reps: 1 }));
});

it('shows a missed set as missed and a bodyweight set without a weight', () => {
  render(
    <>
      <LoggedSetRow index={2} entry={{ reps: 0, weight: 60 }} fallbackWeight={60} targetReps={5} />
      <LoggedSetRow index={1} entry={{ reps: 10 }} fallbackWeight={82} showWeight={false} />
    </>
  );
  expect(screen.getByText('Missed')).toBeTruthy();
  expect(screen.getByLabelText('Set 1: 10 reps')).toBeTruthy();
  expect(screen.queryByText('82 kg')).toBeNull();
});
