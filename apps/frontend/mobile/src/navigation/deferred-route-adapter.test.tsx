import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { DeferredRouteAdapter } from './deferred-route-adapter';
import { PRIMARY_TAB_ROUTES } from './routes';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = jest.mocked(useRouter);

function createRouter(canGoBack: boolean) {
  return {
    back: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    dismiss: jest.fn(),
    dismissTo: jest.fn(),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
    setParams: jest.fn(),
    reload: jest.fn(),
    prefetch: jest.fn(),
  } satisfies ReturnType<typeof useRouter>;
}

describe('DeferredRouteAdapter', () => {
  afterEach(() => {
    mockedUseRouter.mockReset();
  });

  it('uses back history from a reserved placeholder when available', () => {
    const router = createRouter(true);
    mockedUseRouter.mockReturnValue(router);

    render(<DeferredRouteAdapter route="workout_history" />);
    fireEvent.press(screen.getByRole('button', { name: 'Leave this reserved screen' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to Programs for a cold placeholder link without history', () => {
    const router = createRouter(false);
    mockedUseRouter.mockReturnValue(router);

    render(<DeferredRouteAdapter route="program_new" />);
    fireEvent.press(screen.getByRole('button', { name: 'Leave this reserved screen' }));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(PRIMARY_TAB_ROUTES.programs);
  });

  it('keeps invalid dynamic parameters safe and provides the same exit', () => {
    const router = createRouter(false);
    mockedUseRouter.mockReturnValue(router);

    render(<DeferredRouteAdapter route="exercise_detail" validIdentifier={false} />);

    expect(screen.getByText('This link is invalid or incomplete.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Leave this reserved screen' }));
    expect(router.replace).toHaveBeenCalledWith(PRIMARY_TAB_ROUTES.programs);
  });
});
