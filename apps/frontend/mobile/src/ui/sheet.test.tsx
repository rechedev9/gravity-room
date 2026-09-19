import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Modal, Text } from 'react-native';
import { Sheet } from './sheet';

describe('Sheet', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderSheet(onClose: () => void) {
    render(
      <Sheet visible title="Weights" onClose={onClose}>
        <Text>body</Text>
      </Sheet>
    );
    return screen.UNSAFE_getByType(Modal);
  }

  it('closes on a back press when the keyboard is hidden', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const onClose = jest.fn();

    fireEvent(renderSheet(onClose), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only hides the keyboard on a back press while it is visible', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onClose = jest.fn();

    fireEvent(renderSheet(onClose), 'requestClose');

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
