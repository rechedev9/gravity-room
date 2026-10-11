import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import i18n from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { CatalogEntry } from '@gzclp/domain/schemas/catalog';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly to: string;
    readonly [k: string]: unknown;
  }) => createElement('a', { ...rest, href: to } as Record<string, unknown>, children),
}));
vi.mock('@/contexts/tracker-context', () => ({ useTracker: () => ({ setTracker: vi.fn() }) }));
vi.mock('@/lib/api-functions', () => ({ fetchCatalogList: vi.fn() }));

import { fetchCatalogList } from '@/lib/api-functions';
import { ProgramCatalog } from './program-catalog';

const entry = (over: Partial<CatalogEntry> & Pick<CatalogEntry, 'id' | 'name'>): CatalogEntry => ({
  description: 'Programa',
  author: 'Gravity Room',
  category: 'strength',
  level: 'beginner',
  source: 'preset',
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  cycleLength: 4,
  ...over,
});

const ENTRIES: readonly CatalogEntry[] = [
  entry({ id: 'gzclp', name: 'GZCLP' }),
  entry({ id: 'hexan-ppl', name: 'HeXaN PPL', level: 'intermediate', category: 'hypertrophy' }),
  entry({ id: 'nivel-7', name: 'Nivel 7', level: 'advanced' }),
];

function renderCatalog(activeProgramId: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(ProgramCatalog, { activeProgramId })
    )
  );
}

describe('ProgramCatalog', () => {
  beforeEach(() => {
    vi.mocked(fetchCatalogList).mockResolvedValue(ENTRIES);
  });
  afterEach(async () => {
    cleanup();
    vi.clearAllMocks();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('features gzclp and lists every program with its cover and the count', async () => {
    renderCatalog();
    expect(await screen.findByTestId('featured-program')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('3');
    // featured cover + one thumbnail per row
    expect(screen.getAllByTestId('program-cover')).toHaveLength(1 + 3);
  });

  it('filters by search text and hides the featured card while a filter is active', async () => {
    renderCatalog();
    await screen.findByTestId('featured-program');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hexan' } });
    expect(screen.queryByTestId('featured-program')).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'HeXaN PPL' })).toBeInTheDocument();
  });

  it('filters by level chip', async () => {
    renderCatalog();
    await screen.findByTestId('featured-program');
    fireEvent.click(screen.getByRole('button', { name: 'Avanzado' }));
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Nivel 7' })).toBeInTheDocument();
  });

  it('shows a designed empty state and resets the filters from it', async () => {
    renderCatalog();
    await screen.findByTestId('featured-program');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('3');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('leaves the active program out of the catalog', async () => {
    renderCatalog('gzclp');
    await waitFor(() => expect(screen.getByTestId('catalog-count')).toHaveTextContent('2'));
    expect(screen.queryByTestId('featured-program')).not.toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    vi.mocked(fetchCatalogList).mockReturnValue(new Promise(() => {}));
    renderCatalog();
    expect(screen.getByTestId('catalog-skeleton')).toBeInTheDocument();
  });

  it('shows a retryable error state when the catalog fails to load', async () => {
    vi.mocked(fetchCatalogList).mockRejectedValueOnce(new Error('boom'));
    renderCatalog();
    expect(await screen.findByTestId('catalog-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('featured-program')).toBeInTheDocument();
  });
});
