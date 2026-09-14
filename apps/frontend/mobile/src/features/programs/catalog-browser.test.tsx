import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CatalogEntry } from '@gzclp/domain';
import { CatalogBrowser } from './catalog-browser';

const entries: CatalogEntry[] = [
  {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'Fuerza con énfasis lineal',
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

it('combines filters, matches accent-insensitively, and resets every filter from an empty result', () => {
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
  fireEvent.press(screen.getByRole('button', { name: 'Reset filters' }));
  // The reset restores the featured card plus GZCLP's catalog row.
  expect(screen.getAllByRole('button', { name: 'View GZCLP' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'View Boring But Big' })).toBeTruthy();
  expect(screen.getByLabelText('2 programs')).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('Search programs'), '  ENFASIS ');
  expect(screen.getByRole('button', { name: 'View GZCLP' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'View Boring But Big' })).toBeNull();
});

it('keeps a catalog loading error distinct from an empty filter result and retries it', () => {
  const onRetry = jest.fn();
  render(
    <CatalogBrowser
      entries={[]}
      loading={false}
      error="Catalog is unavailable"
      creatingId={null}
      onRetry={onRetry}
      onStart={jest.fn()}
    />
  );

  expect(screen.getByText('Catalog is unavailable')).toBeTruthy();
  expect(screen.queryByText('No programs match. Try another search or level.')).toBeNull();
  expect(screen.queryByLabelText('0 programs')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
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
  expect(screen.getByText('Fuerza con énfasis lineal')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP' }));
  await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Start GZCLP' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Start GZCLP' })).toBeNull());
});
