import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { startPresetProgram } from '../../lib/programs/program-use-cases';
import { readPendingCreateReconciliation } from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  fetchCatalogDefinition,
} from '../../lib/programs/program-service';
import {
  getProgramDefinition,
  upsertProgramDefinition,
} from '../../lib/tracker/program-detail-repository';
import { PresetSetupScreen } from './preset-setup-screen';
import i18n from '../../lib/i18n';

jest.mock('../../lib/programs/program-use-cases', () => ({
  startPresetProgram: jest.fn(),
}));

jest.mock('../../lib/programs/program-repository', () => ({
  readPendingCreateReconciliation: jest.fn(),
}));

jest.mock('../../lib/programs/program-service', () => ({
  buildDefaultProgramConfig: jest.fn(),
  fetchCatalogDefinition: jest.fn(),
}));

jest.mock('../../lib/tracker/program-detail-repository', () => ({
  getProgramDefinition: jest.fn(),
  upsertProgramDefinition: jest.fn(),
}));

const mockedStartPresetProgram = jest.mocked(startPresetProgram);
const mockedReadPendingCreateReconciliation = jest.mocked(readPendingCreateReconciliation);
const mockedBuildDefaultProgramConfig = jest.mocked(buildDefaultProgramConfig);
const mockedFetchCatalogDefinition = jest.mocked(fetchCatalogDefinition);
const mockedGetProgramDefinition = jest.mocked(getProgramDefinition);
const mockedUpsertProgramDefinition = jest.mocked(upsertProgramDefinition);
const mockBack = jest.fn();
const mockCreated = jest.fn<void, [string]>();

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 'T1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

const DETAIL = {
  id: '11111111-1111-4111-8111-111111111111',
  programId: 'gzclp',
  name: 'GZCLP',
  config: { squat: 22.5 },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
} satisfies GenericProgramDetail;

function renderSetup() {
  return render(
    <PresetSetupScreen
      onBack={mockBack}
      onCreated={mockCreated}
      ownerUserId="user-a"
      programId="gzclp"
    />
  );
}

describe('PresetSetupScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    mockedGetProgramDefinition.mockResolvedValue(null);
    mockedFetchCatalogDefinition.mockResolvedValue(DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 20 });
    mockedStartPresetProgram.mockResolvedValue({ status: 'applied', remote: DETAIL });
    mockedReadPendingCreateReconciliation.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows days, exercises, rules and estimated duration in the preset detail', async () => {
    renderSetup();

    expect(await screen.findByText('Days and exercises')).toBeTruthy();
    expect(screen.getByText('Squat · Primary strength')).toBeTruthy();
    expect(screen.getByText('Add weight after success')).toBeTruthy();
    expect(screen.getByText('12 workouts · 3/week · about 4 weeks')).toBeTruthy();
  });

  it('blocks creation until domain validation accepts the setup', async () => {
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 22.5 });
    renderSetup();
    const input = await screen.findByLabelText('Squat starting value');

    expect(input.props.value).toBe('22.5');
    expect(screen.getByText('Minimum 20 kg · increments of 2.5 kg')).toBeTruthy();
    fireEvent.changeText(input, '21');
    fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP with this setup' }));
    expect(await screen.findByText('Use one of the allowed weight increments.')).toBeTruthy();
    expect(mockedStartPresetProgram).not.toHaveBeenCalled();

    fireEvent.changeText(input, '22.5');
    fireEvent.press(screen.getByRole('button', { name: 'Start GZCLP with this setup' }));

    await waitFor(() => {
      expect(mockedStartPresetProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        definition: DEFINITION,
        name: 'GZCLP',
        config: { squat: 22.5 },
      });
    });
    expect(mockCreated).toHaveBeenCalledWith(DETAIL.id);
  });

  it('reads a cached definition offline while explaining that create remains online-only', async () => {
    mockedGetProgramDefinition.mockResolvedValue(DEFINITION);
    mockedFetchCatalogDefinition.mockRejectedValue(new Error('offline'));

    renderSetup();

    expect(
      await screen.findByText(
        'Offline: showing the saved preset. Starting it still requires internet.'
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Creating a program requires internet because the server assigns its identity and cannot safely retry this request yet.'
      )
    ).toBeTruthy();
  });

  it('does not claim a local create when the online-only use case fails', async () => {
    mockedStartPresetProgram.mockRejectedValue(new Error('offline'));
    renderSetup();

    fireEvent.press(await screen.findByRole('button', { name: 'Start GZCLP with this setup' }));

    expect(
      await screen.findByText(
        'The server rejected the request before confirming creation. Review your connection before trying again.'
      )
    ).toBeTruthy();
    expect(mockCreated).not.toHaveBeenCalled();
  });

  it('parses the Spanish decimal separator at the component boundary', async () => {
    await act(async () => {
      await i18n.changeLanguage('es');
    });
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 22.5 });
    renderSetup();
    const input = await screen.findByLabelText('Valor inicial de Sentadilla');

    expect(input.props.value).toBe('22,5');
    expect(screen.getByText('Mínimo 20 kg · incrementos de 2,5 kg')).toBeTruthy();
    fireEvent.changeText(input, '22,5');
    fireEvent.press(screen.getByRole('button', { name: 'Empezar GZCLP con esta configuración' }));

    await waitFor(() => {
      expect(mockedStartPresetProgram).toHaveBeenCalledWith(
        expect.objectContaining({ config: { squat: 22.5 } })
      );
    });
  });

  it('preserves an edited weight when the locale changes and keeps it parseable', async () => {
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 22.5 });
    renderSetup();
    const input = await screen.findByLabelText('Squat starting value');
    fireEvent.changeText(input, '27.5');

    await act(async () => {
      await i18n.changeLanguage('es');
    });

    const localizedInput = await screen.findByLabelText('Valor inicial de Sentadilla');
    await waitFor(() => {
      expect(localizedInput.props.value).toBe('27,5');
    });
    expect(mockedFetchCatalogDefinition).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Empezar GZCLP con esta configuración' }));
    await waitFor(() => {
      expect(mockedStartPresetProgram).toHaveBeenCalledWith(
        expect.objectContaining({ config: { squat: 27.5 } })
      );
    });
  });

  it('does not overwrite a dirty cached input when deferred revalidation resolves', async () => {
    let resolveRemote: (definition: ProgramDefinition) => void = () => undefined;
    mockedGetProgramDefinition.mockResolvedValue(DEFINITION);
    mockedFetchCatalogDefinition.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemote = resolve;
        })
    );
    mockedBuildDefaultProgramConfig
      .mockReturnValueOnce({ squat: 20 })
      .mockReturnValueOnce({ squat: 40 });
    renderSetup();
    const input = await screen.findByLabelText('Squat starting value');

    fireEvent.changeText(input, '22.5');
    await act(async () => {
      resolveRemote(DEFINITION);
    });

    await waitFor(() => {
      expect(mockedUpsertProgramDefinition).toHaveBeenCalled();
    });
    expect(screen.getByLabelText('Squat starting value').props.value).toBe('22.5');
  });

  it('locks the non-idempotent start action after reconciliation becomes required', async () => {
    mockedStartPresetProgram.mockResolvedValue({
      status: 'reconciliation_required',
      remote: DETAIL,
      remoteEntityId: DETAIL.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    renderSetup();
    const start = await screen.findByRole('button', { name: 'Start GZCLP with this setup' });

    fireEvent.press(start);
    expect(
      await screen.findByText(
        'The server may already have created the program. Gravity Room will verify the result safely; do not press Start again.'
      )
    ).toBeTruthy();
    expect(start.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(start);
    expect(mockedStartPresetProgram).toHaveBeenCalledTimes(1);
  });

  it('keeps start locked after remount while create reconciliation is pending', async () => {
    mockedReadPendingCreateReconciliation.mockResolvedValue({
      pending: true,
      programInstanceId: DETAIL.id,
    });

    renderSetup();
    const start = await screen.findByRole('button', { name: 'Start GZCLP with this setup' });

    expect(start.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(start);
    expect(mockedStartPresetProgram).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Open the program acknowledged by the server' })
    ).toBeTruthy();
  });
});
