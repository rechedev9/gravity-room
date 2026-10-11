import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GenericResults } from '@gzclp/domain/types/program';
import { writeGuestData } from '@/lib/guest-storage-keys';
import { useConfirmProgramReplacement } from './use-confirm-program-replacement';

const { auth, guest, fetchPrograms, toast } = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null },
  guest: { isGuest: false },
  fetchPrograms: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/guest-context', () => ({ useGuest: () => guest }));
vi.mock('@/lib/api-functions', () => ({ fetchPrograms }));
vi.mock('@/contexts/toast-context', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

const ACTIVE = { id: 'i1', programId: 'gzclp', name: 'GZCLP', status: 'active' };

function storeGuestProgram(results: GenericResults): void {
  writeGuestData({
    version: 1,
    activeProgramId: 'guest',
    instances: {
      guest: {
        id: 'guest',
        programId: 'gzclp',
        name: 'GZCLP',
        config: { squat: 60 },
        results,
        undoHistory: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  });
}

let outcome: Promise<boolean> | null = null;

function Harness(): ReactNode {
  const { confirmReplacement, dialog } = useConfirmProgramReplacement();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          outcome = confirmReplacement('StrongLifts 5x5');
        }}
      >
        start
      </button>
      {dialog}
    </>
  );
}

function renderHarness(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
}

async function press(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText('start'));
  });
}

describe('useConfirmProgramReplacement', () => {
  beforeEach(() => {
    outcome = null;
    auth.user = { id: 'u1' };
    guest.isGuest = false;
    fetchPrograms.mockReset();
    toast.mockReset();
    localStorage.clear();
  });
  afterEach(cleanup);

  it('lets a first program start without asking', async () => {
    fetchPrograms.mockResolvedValue([]);
    renderHarness();

    await press();

    await expect(outcome).resolves.toBe(true);
    expect(screen.getByRole('dialog', { hidden: true }).hasAttribute('open')).toBe(false);
  });

  it('lets a guest with no logged results start without asking', async () => {
    auth.user = null;
    guest.isGuest = true;
    storeGuestProgram({});
    renderHarness();

    await press();

    await expect(outcome).resolves.toBe(true);
    expect(fetchPrograms).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { hidden: true }).hasAttribute('open')).toBe(false);
  });

  it('asks a guest before a start wipes the results logged on this device', async () => {
    auth.user = null;
    guest.isGuest = true;
    storeGuestProgram({ '0': { 'squat-t1': { result: 'success' } } });
    renderHarness();

    await press();

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('StrongLifts 5x5');
    expect(dialog.textContent).toContain('GZCLP');
    expect(dialog.textContent).toContain('se borrarán');
    expect(fetchPrograms).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Cancelar'));
    });
    await expect(outcome).resolves.toBe(false);
  });

  it('starts the guest program once the guest accepts losing the results', async () => {
    auth.user = null;
    guest.isGuest = true;
    storeGuestProgram({ '0': { 'squat-t1': { result: 'success' } } });
    renderHarness();

    await press();
    await act(async () => {
      fireEvent.click(screen.getByText('Reemplazar y empezar'));
    });

    await expect(outcome).resolves.toBe(true);
  });

  it('does not start when the active program cannot be checked, and says so', async () => {
    fetchPrograms.mockRejectedValue(new Error('network down'));
    renderHarness();

    await press();

    await expect(outcome).resolves.toBe(false);
    expect(toast).toHaveBeenCalledWith({
      message: 'No se pudo comprobar tu programa activo. Inténtalo de nuevo.',
    });
    expect(screen.getByRole('dialog', { hidden: true }).hasAttribute('open')).toBe(false);
  });

  it('asks before ending the active program and holds the start until answered', async () => {
    fetchPrograms.mockResolvedValue([ACTIVE]);
    renderHarness();

    await press();

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('StrongLifts 5x5');
    expect(dialog.textContent).toContain('GZCLP');

    const settled = vi.fn();
    void outcome?.then(settled);
    await act(async () => {});
    expect(settled).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Finalizar y empezar'));
    });
    await expect(outcome).resolves.toBe(true);
  });

  it('cancels the start when the user backs out', async () => {
    fetchPrograms.mockResolvedValue([ACTIVE]);
    renderHarness();

    await press();
    await act(async () => {
      fireEvent.click(screen.getByText('Cancelar'));
    });

    await expect(outcome).resolves.toBe(false);
  });
});
