/**
 * MyDefinitionsPanel tests (REQ-DGUARD-003).
 * Verifies 409 inline error display for deletion guard.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock useDefinitions hook BEFORE importing the component
// ---------------------------------------------------------------------------

const DELETE_409_MESSAGE =
  'No se puede eliminar — hay un programa activo basado en esta definición. Completa o elimina el programa primero.';

const mockUseDefinitions = mock(() => ({
  definitions: [
    {
      id: 'def-1',
      userId: 'user-1',
      definition: { name: 'Mi Programa' },
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    },
    {
      id: 'def-2',
      userId: 'user-1',
      definition: { name: 'Otro Programa' },
      status: 'draft',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: null,
    },
  ],
  isLoading: false,
  deleteDefinition: mock(),
  isDeleting: false,
  deleteError: null as string | null,
  deleteErrorDefId: null as string | null,
  clearDeleteError: mock(),
  fork: mock(),
  forkAsync: mock(),
  isForking: false,
}));

mock.module('@/hooks/use-definitions', () => ({
  useDefinitions: mockUseDefinitions,
}));

// Must import AFTER mock.module
const { MyDefinitionsPanel } = await import('./my-definitions-panel');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const baseProps = {
  onOpenWizard: mock(),
  onStartProgram: mock(),
};

describe('MyDefinitionsPanel — deletion guard 409 error (REQ-DGUARD-003)', () => {
  beforeEach(() => {
    mockUseDefinitions.mockClear();
  });

  it('shows inline error message when deleteError is set for a specific definition', () => {
    mockUseDefinitions.mockImplementation(() => ({
      definitions: [
        {
          id: 'def-1',
          userId: 'user-1',
          definition: { name: 'Mi Programa' },
          status: 'draft',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      isLoading: false,
      deleteDefinition: mock(),
      isDeleting: false,
      deleteError: DELETE_409_MESSAGE,
      deleteErrorDefId: 'def-1',
      clearDeleteError: mock(),
      fork: mock(),
      forkAsync: mock(),
      isForking: false,
    }));

    render(<MyDefinitionsPanel {...baseProps} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(DELETE_409_MESSAGE)).toBeInTheDocument();
  });

  it('does not show error message for definitions other than the errored one', () => {
    mockUseDefinitions.mockImplementation(() => ({
      definitions: [
        {
          id: 'def-1',
          userId: 'user-1',
          definition: { name: 'Mi Programa' },
          status: 'draft',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'def-2',
          userId: 'user-1',
          definition: { name: 'Otro Programa' },
          status: 'draft',
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      isLoading: false,
      deleteDefinition: mock(),
      isDeleting: false,
      deleteError: DELETE_409_MESSAGE,
      deleteErrorDefId: 'def-1',
      clearDeleteError: mock(),
      fork: mock(),
      forkAsync: mock(),
      isForking: false,
    }));

    render(<MyDefinitionsPanel {...baseProps} />);

    // Only one alert should be rendered (for def-1 only)
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(1);
  });

  it('does not show error message when error is non-409 (deleteError is null)', () => {
    mockUseDefinitions.mockImplementation(() => ({
      definitions: [
        {
          id: 'def-1',
          userId: 'user-1',
          definition: { name: 'Mi Programa' },
          status: 'draft',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      isLoading: false,
      deleteDefinition: mock(),
      isDeleting: false,
      deleteError: null,
      deleteErrorDefId: null,
      clearDeleteError: mock(),
      fork: mock(),
      forkAsync: mock(),
      isForking: false,
    }));

    render(<MyDefinitionsPanel {...baseProps} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
