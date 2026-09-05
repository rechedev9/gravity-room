import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TrackerSetRow } from './tracker-set-row';

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
