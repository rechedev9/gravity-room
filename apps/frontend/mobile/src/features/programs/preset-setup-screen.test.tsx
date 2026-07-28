import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { startPresetProgram } from '../../lib/programs/program-use-cases';
import { readPendingCreateReconciliation } from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  fetchCatalogDefinition,
} from '../../lib/programs/program-service';
import {
  commitProgramDefinitionRefresh,
  getProgramDefinition,
} from '../../lib/tracker/program-detail-repository';
import { isProgramRefreshLeaseCurrent } from '../../lib/programs/program-refresh-generation';
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
  commitProgramDefinitionRefresh: jest.fn(),
  getProgramDefinition: jest.fn(),
}));

jest.mock('../../lib/auth/session', () => ({
  captureAuthorizedSession: jest.fn((ownerUserId: string) => ({
    ownerUserId,
    accessToken: 'token-a',
    generation: 1,
  })),
  isAuthorizedSessionCurrent: jest.fn(() => true),
}));

jest.mock('../../lib/programs/program-refresh-generation', () => ({
  abandonProgramRefreshLease: jest.fn(),
  captureProgramRefreshLease: jest.fn(
    (ownerUserId: string, resource: string, session: unknown) => ({
      ownerUserId,
      resource,
      generation: 0,
      session,
    })
  ),
  isProgramRefreshLeaseCurrent: jest.fn(() => true),
  withProgramRefreshCommitBarrier: jest.fn(
    (_ownerUserId: string, _resource: string, task: () => Promise<unknown>) => task()
  ),
}));

const mockedStartPresetProgram = jest.mocked(startPresetProgram);
const mockedReadPendingCreateReconciliation = jest.mocked(readPendingCreateReconciliation);
const mockedBuildDefaultProgramConfig = jest.mocked(buildDefaultProgramConfig);
const mockedFetchCatalogDefinition = jest.mocked(fetchCatalogDefinition);
const mockedGetProgramDefinition = jest.mocked(getProgramDefinition);
const mockedCommitProgramDefinitionRefresh = jest.mocked(commitProgramDefinitionRefresh);
const mockedIsProgramRefreshLeaseCurrent = jest.mocked(isProgramRefreshLeaseCurrent);
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
      name: 'Día 1',
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildMutenroshiDefinition(): ProgramDefinition {
  // Keep this tied to the production Caparazón seed without making the mobile
  // compiler adopt the database package's looser test-only tsconfig.
  const seedPath = ['../../../../../../packages/database/src/seeds/programs', 'mutenroshi'].join(
    '/'
  );
  const seedModule: unknown = jest.requireActual(seedPath);
  if (!isRecord(seedModule) || !isRecord(seedModule['MUTENROSHI_DEFINITION_JSONB'])) {
    throw new Error('Caparazón seed definition is unavailable');
  }

  const seedDefinition = seedModule['MUTENROSHI_DEFINITION_JSONB'];
  const days = seedDefinition['days'];
  if (!Array.isArray(days)) {
    throw new Error('Caparazón seed days are malformed');
  }

  const exerciseIds = new Set<string>();
  for (const day of days) {
    if (!isRecord(day) || !Array.isArray(day['slots'])) {
      throw new Error('Caparazón seed slots are malformed');
    }
    for (const slot of day['slots']) {
      if (!isRecord(slot) || typeof slot['exerciseId'] !== 'string') {
        throw new Error('Caparazón seed exercise is malformed');
      }
      exerciseIds.add(slot['exerciseId']);
    }
  }

  return ProgramDefinitionSchema.parse({
    ...seedDefinition,
    exercises: Object.fromEntries(
      [...exerciseIds].map((exerciseId) => [exerciseId, { name: exerciseId }])
    ),
  });
}

function buildDefinitionDefaults(definition: ProgramDefinition): Record<string, number | string> {
  const defaults: Record<string, number | string> = {};
  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      defaults[field.key] = field.min;
      continue;
    }
    const firstOption = field.options[0];
    if (firstOption === undefined) {
      throw new Error(`Missing option fixture for ${field.key}`);
    }
    defaults[field.key] = firstOption.value;
  }
  return defaults;
}

describe('PresetSetupScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    mockedGetProgramDefinition.mockResolvedValue(null);
    mockedFetchCatalogDefinition.mockResolvedValue(DEFINITION);
    mockedCommitProgramDefinitionRefresh.mockResolvedValue(true);
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(true);
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

  it('hides the previous preset synchronously when owner and program change', async () => {
    const view = renderSetup();
    expect(await screen.findByRole('button', { name: 'Start GZCLP with this setup' })).toBeTruthy();

    mockedGetProgramDefinition.mockImplementation(() => new Promise(() => undefined));
    mockedFetchCatalogDefinition.mockImplementation(() => new Promise(() => undefined));
    view.rerender(
      <PresetSetupScreen
        onBack={mockBack}
        onCreated={mockCreated}
        ownerUserId="user-b"
        programId="another-preset"
      />
    );

    expect(screen.queryByRole('button', { name: 'Start GZCLP with this setup' })).toBeNull();
    expect(screen.getByText('Loading preset…')).toBeTruthy();
  });

  it('lets a new owner submit while ignoring a hung previous-owner completion', async () => {
    let resolveOwnerA: (value: { status: 'applied'; remote: GenericProgramDetail }) => void = () =>
      undefined;
    const ownerAResult = new Promise<{ status: 'applied'; remote: GenericProgramDetail }>(
      (resolve) => {
        resolveOwnerA = resolve;
      }
    );
    mockedStartPresetProgram
      .mockImplementationOnce(() => ownerAResult)
      .mockResolvedValueOnce({
        status: 'applied',
        remote: { ...DETAIL, id: 'owner-b-program' },
      });
    const view = renderSetup();

    fireEvent.press(await screen.findByRole('button', { name: 'Start GZCLP with this setup' }));
    view.rerender(
      <PresetSetupScreen
        onBack={mockBack}
        onCreated={mockCreated}
        ownerUserId="user-b"
        programId="gzclp"
      />
    );

    const ownerBStart = await screen.findByRole('button', {
      name: 'Start GZCLP with this setup',
    });
    expect(ownerBStart.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(ownerBStart);
    await waitFor(() => {
      expect(mockedStartPresetProgram).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ ownerUserId: 'user-b' })
      );
      expect(mockCreated).toHaveBeenCalledWith('owner-b-program');
    });

    await act(async () => {
      resolveOwnerA({ status: 'applied', remote: DETAIL });
    });
    expect(mockCreated).not.toHaveBeenCalledWith(DETAIL.id);
  });

  it('settles to an error when a superseding definition refresh has not committed cache yet', async () => {
    mockedCommitProgramDefinitionRefresh.mockResolvedValue(false);

    renderSetup();

    expect(await screen.findByText('Preset unavailable')).toBeTruthy();
    expect(screen.queryByText('Loading preset…')).toBeNull();
  });

  it('settles a successful definition commit from a queued mutation winner', async () => {
    const winningDefinition = {
      ...DEFINITION,
      name: 'Mutation-winning preset',
      source: 'custom',
    } satisfies ProgramDefinition;
    mockedGetProgramDefinition.mockResolvedValueOnce(null).mockResolvedValueOnce(winningDefinition);
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderSetup();

    expect(
      await screen.findByRole('button', {
        name: 'Start Mutation-winning preset with this setup',
      })
    ).toBeTruthy();
    expect(screen.queryByText('Preset unavailable')).toBeNull();
  });

  it('settles a failed obsolete definition request from winning SQLite truth', async () => {
    const winningDefinition = {
      ...DEFINITION,
      name: 'Offline mutation winner',
      source: 'custom',
    } satisfies ProgramDefinition;
    mockedGetProgramDefinition
      .mockResolvedValueOnce(DEFINITION)
      .mockResolvedValueOnce(winningDefinition);
    mockedFetchCatalogDefinition.mockRejectedValue(new Error('offline after mutation'));
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderSetup();

    expect(
      await screen.findByRole('button', {
        name: 'Start Offline mutation winner with this setup',
      })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start GZCLP with this setup' })).toBeNull();
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
      expect(mockedCommitProgramDefinitionRefresh).toHaveBeenCalled();
    });
    expect(screen.getByLabelText('Squat starting value').props.value).toBe('22.5');
  });

  it('collapses and paginates when cache-first revalidation grows into a large preview', async () => {
    const largeDefinition = buildMutenroshiDefinition();
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
      .mockReturnValueOnce(buildDefinitionDefaults(largeDefinition));

    renderSetup();
    expect(await screen.findAllByTestId('program-preview-day')).toHaveLength(1);

    await act(async () => {
      resolveRemote(largeDefinition);
    });

    const showPreview = await screen.findByRole('button', {
      name: 'Show the first training days',
    });
    expect(screen.queryAllByTestId('program-preview-day')).toHaveLength(0);

    fireEvent.press(showPreview);
    expect(await screen.findAllByTestId('program-preview-day')).toHaveLength(10);
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

  it('keeps a real 200-day preset operable before a bounded, paginated preview', async () => {
    const largeDefinition = buildMutenroshiDefinition();
    const defaults = buildDefinitionDefaults(largeDefinition);
    mockedFetchCatalogDefinition.mockResolvedValue(largeDefinition);
    mockedBuildDefaultProgramConfig.mockReturnValue(defaults);
    mockedStartPresetProgram.mockResolvedValue({
      status: 'applied',
      remote: { ...DETAIL, programId: largeDefinition.id },
    });

    render(
      <PresetSetupScreen
        onBack={mockBack}
        onCreated={mockCreated}
        ownerUserId="user-a"
        programId={largeDefinition.id}
      />
    );

    const start = await screen.findByRole('button', {
      name: 'Start Turtle Shell with this setup',
    });
    const showPreview = screen.getByRole('button', {
      name: 'Show the first training days',
    });
    const accessibleButtons = screen.getAllByRole('button');
    expect(accessibleButtons.indexOf(start)).toBeLessThan(accessibleButtons.indexOf(showPreview));
    expect(screen.queryAllByTestId('program-preview-day')).toHaveLength(0);
    expect(screen.queryAllByTestId('program-preview-slot')).toHaveLength(0);

    fireEvent.press(start);
    await waitFor(() => {
      expect(mockedStartPresetProgram).toHaveBeenCalledWith(
        expect.objectContaining({
          definition: largeDefinition,
          config: defaults,
        })
      );
    });

    fireEvent.press(showPreview);
    expect(await screen.findAllByTestId('program-preview-day')).toHaveLength(10);
    expect(screen.getAllByTestId('program-preview-slot').length).toBeLessThan(100);

    fireEvent.press(screen.getByRole('button', { name: 'Show the next 10 training days' }));
    expect(screen.getAllByTestId('program-preview-day')).toHaveLength(20);
    expect(screen.getAllByTestId('program-preview-slot').length).toBeLessThan(200);

    fireEvent.press(screen.getByRole('button', { name: 'Collapse the training-day preview' }));
    expect(screen.queryAllByTestId('program-preview-day')).toHaveLength(0);
  });
});
