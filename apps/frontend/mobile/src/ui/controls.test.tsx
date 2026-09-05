import { fireEvent, render, screen } from '@testing-library/react-native';
import { Stepper } from './stepper';
import { SegmentedChoice } from './segmented-choice';
import { Sheet } from './sheet';
import { TextInput } from './text-input';

it('prevents a weight increment beyond the allowed maximum', () => {
  const change = jest.fn();
  render(<Stepper label="Weight" value={100} min={0} max={100} step={2.5} onChange={change} />);
  fireEvent.press(screen.getByRole('button', { name: 'Increase Weight' }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Decrease Weight' }));
  expect(change).toHaveBeenCalledWith(97.5);
});

it('exposes a single selected option and respects disabled choice groups', () => {
  const change = jest.fn();
  const options = [
    { value: 'kg', label: 'Kilograms' },
    { value: 'lb', label: 'Pounds' },
  ];
  const view = render(
    <SegmentedChoice label="Units" value="kg" options={options} onChange={change} />
  );
  expect(screen.getByRole('radio', { name: 'Kilograms', checked: true })).toBeTruthy();
  view.rerender(
    <SegmentedChoice label="Units" value="kg" options={options} onChange={change} disabled />
  );
  fireEvent.press(screen.getByRole('radio', { name: 'Pounds' }));
  expect(change).not.toHaveBeenCalled();
});

it('labels editable fields inside a closable sheet', () => {
  const close = jest.fn();
  const change = jest.fn();
  render(
    <Sheet visible title="Exercise" onClose={close}>
      <TextInput label="Name" value="Squat" onChangeText={change} />
    </Sheet>
  );
  fireEvent.changeText(screen.getByLabelText('Name'), 'Bench');
  expect(change).toHaveBeenCalledWith('Bench');
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(close).toHaveBeenCalledTimes(1);
});
