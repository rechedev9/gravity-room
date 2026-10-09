import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExerciseEntry } from '@gzclp/domain';
import {
  ExerciseRequestError,
  fetchExercisePage,
  fetchMuscleGroups,
  type ExercisePage,
} from '../../lib/exercises/exercise-service';
import { ExercisesScreen } from './exercises-screen';

jest.mock('../../lib/exercises/exercise-service', () => ({
  ...jest.requireActual('../../lib/exercises/exercise-service'),
  fetchExercisePage: jest.fn(),
  fetchMuscleGroups: jest.fn(),
}));

const pageMock = jest.mocked(fetchExercisePage);
const groupsMock = jest.mocked(fetchMuscleGroups);

function exercise(overrides: Partial<ExerciseEntry>): ExerciseEntry {
  return {
    id: 'squat',
    name: 'Sentadilla',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
    isPreset: true,
    createdBy: null,
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    category: 'strength',
    secondaryMuscles: ['core'],
    ...overrides,
  };
}

function page(items: readonly ExerciseEntry[], total = items.length): ExercisePage {
  return { items, total, offset: 0, received: items.length };
}

function renderScreen(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExercisesScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  groupsMock.mockResolvedValue([
    { id: 'legs', name: 'Piernas' },
    { id: 'chest', name: 'Pecho' },
  ]);
});

it('lists exercises with translated muscle and equipment and opens a detail sheet', async () => {
  pageMock.mockResolvedValue(page([exercise({})], 811));
  renderScreen();

  expect(await screen.findByText('Sentadilla')).toBeTruthy();
  expect(screen.getByText('Legs · Barbell')).toBeTruthy();
  expect(screen.getByText('811 exercises')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'View Sentadilla' }));
  expect(await screen.findByText('Beginner')).toBeTruthy();
  expect(screen.getByText('Compound')).toBeTruthy();
  expect(screen.getByText('Also works')).toBeTruthy();
  expect(screen.getByText('Core')).toBeTruthy();
});

it('lists a repeated secondary muscle once', async () => {
  pageMock.mockResolvedValue(page([exercise({ secondaryMuscles: ['core', 'core', 'arms'] })]));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'View Sentadilla' }));
  expect(await screen.findByText('Arms')).toBeTruthy();
  expect(screen.getAllByText('Core')).toHaveLength(1);
});

it('searches after a pause and filters by muscle group', async () => {
  pageMock.mockResolvedValue(page([exercise({})]));
  renderScreen();
  await screen.findByText('Sentadilla');

  fireEvent.changeText(screen.getByLabelText('Search exercises'), 'press');
  await waitFor(() =>
    expect(pageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { search: 'press', muscleGroupId: null } })
    )
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Chest' }));
  await waitFor(() =>
    expect(pageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { search: 'press', muscleGroupId: 'chest' } })
    )
  );
});

it('offers to clear filters when nothing matches', async () => {
  pageMock.mockResolvedValue(page([]));
  renderScreen();
  fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'zzz');
  expect(await screen.findByText('No exercises match')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByLabelText('Search exercises').props.value).toBe('');
});

it('explains being offline and recovers on retry', async () => {
  pageMock.mockRejectedValueOnce(new ExerciseRequestError('network'));
  pageMock.mockResolvedValue(page([exercise({})]));
  renderScreen();

  expect(await screen.findByText('You are offline')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Sentadilla')).toBeTruthy();
});

it('distinguishes a server failure from being offline', async () => {
  pageMock.mockRejectedValue(new ExerciseRequestError('server'));
  renderScreen();
  expect(await screen.findByText('Could not load exercises')).toBeTruthy();
});
