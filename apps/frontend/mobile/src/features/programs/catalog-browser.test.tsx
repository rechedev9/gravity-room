import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CatalogEntry } from '@gzclp/domain';
import { CatalogBrowser } from './catalog-browser';

const entries: CatalogEntry[] = [
  {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'Linear strength training',
    author: 'Cody',
    category: 'strength',
    level: 'beginner',
    source: 'preset',
    totalWorkouts: 36,
    workoutsPerWeek: 3,
    cycleLength: 4,
  },
  {
    id: 'bbb',
    name: 'Boring But Big',
    description: 'Intermediate strength training',
    author: 'Jim',
    category: 'strength',
    level: 'intermediate',
    source: 'preset',
    totalWorkouts: 48,
    workoutsPerWeek: 4,
    cycleLength: 4,
  },
];

it('combines level and text filters and recovers from an empty search', () => {
  render(
    <CatalogBrowser
      entries={entries}
      loading={false}
      error={null}
      creatingId={null}
      onRetry={jest.fn()}
      onStart={jest.fn()}
    />
  );
  fireEvent.press(screen.getByText('Intermediate'));
  expect(screen.queryAllByRole('button', { name: 'View GZCLP' })).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'View Boring But Big' })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Search programs'), 'no-match');
  expect(screen.getByText('No programs match. Try another search or level.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('button', { name: 'View Boring But Big' })).toBeTruthy();
  fireEvent.press(screen.getByText('All'));
  fireEvent.changeText(screen.getByLabelText('Search programs'), 'gzclp');
  expect(screen.getAllByRole('button', { name: 'View GZCLP' })).toHaveLength(1);
});

it('keeps details open on failed creation and closes them after successful creation', async () => {
  const onStart = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(
    <CatalogBrowser
      entries={entries}
      loading={false}
      error={null}
      creatingId={null}
      onRetry={jest.fn()}
      onStart={onStart}
    />
  );
  expect(screen.queryByRole('button', { name: 'Start GZCLP' })).toBeNull();
  fireEvent.press(screen.getByText('View program'));
  expect(screen.getByText('Linear strength training')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP' }));
  await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Start GZCLP' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Start GZCLP' })).toBeNull());
});
