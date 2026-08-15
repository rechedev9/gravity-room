import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogList, fetchCatalogDetail } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { useProgram } from '@/hooks/use-program';
import { useGuestProgram } from '@/hooks/use-guest-program';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { captureError } from '@/lib/sentry';
import { AppSkeleton } from '@/components/app-skeleton';
import { GuestWall } from './guest-wall';
import { StartStepper, type StartStep } from './start-stepper';
import { StepProgram } from './step-program';
import { StepWeights } from './step-weights';
import { StepFirstDay } from './step-first-day';

type WeightField = ProgramDefinition['configFields'][number] & { type: 'weight' };

function weightFields(definition: ProgramDefinition | undefined): readonly WeightField[] {
  if (definition === undefined) return [];
  return definition.configFields.filter((f): f is WeightField => f.type === 'weight');
}

/**
 * Build the config the engine expects: the weights the user entered, plus the
 * default of every non-weight field (rounding, bar, variants) so the guided
 * flow never asks about knobs a first session does not need.
 */
function buildConfig(
  definition: ProgramDefinition,
  weights: Readonly<Record<string, number | undefined>>
): Record<string, number | string> {
  const config: Record<string, number | string> = {};
  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      config[field.key] = weights[field.key] ?? field.min;
      continue;
    }
    const fallback = field.options[0]?.value;
    if (fallback !== undefined) config[field.key] = fallback;
  }
  return config;
}

/**
 * `/app/start` — the guided beginning the product never had. One decision per
 * screen (program, loads, first day), with the guest trade-off shown before a
 * session is invested rather than discovered through toasts afterwards.
 */
export function StartPage(): ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { setTracker } = useTracker();

  useDocumentTitle(t('onboarding.page_title'));

  const [step, setStep] = useState<StartStep>('program');
  const [guestWallSeen, setGuestWallSeen] = useState(!isGuest);
  const [programId, setProgramId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Readonly<Record<string, number | undefined>>>({});

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId ?? ''),
    queryFn: () => fetchCatalogDetail(programId ?? ''),
    staleTime: 5 * 60 * 1000,
    enabled: programId !== null,
  });
  const definition = detailQuery.data;

  // Both hooks must run (Rules of Hooks); only the active identity path writes.
  const authProgram = useProgram(programId ?? '', undefined, {
    enabled: !isGuest && user !== null && programId !== null,
  });
  const guestProgram = useGuestProgram(programId ?? '', {
    enabled: isGuest && programId !== null,
  });
  const target = isGuest ? guestProgram : authProgram;

  const fields = weightFields(definition);
  const previewConfig = useMemo(
    () => (definition !== undefined ? buildConfig(definition, weights) : null),
    [definition, weights]
  );
  const firstWorkout = useMemo(() => {
    if (definition === undefined || previewConfig === null) return null;
    return computeGenericProgram(definition, previewConfig, {}, { maxRows: 1 })[0] ?? null;
  }, [definition, previewConfig]);

  const [isStarting, setIsStarting] = useState(false);

  const generate = async (thenGoToTracker: boolean): Promise<void> => {
    if (definition === undefined || previewConfig === null || programId === null) return;
    setIsStarting(true);
    try {
      await target.generateProgram(previewConfig);
      setTracker(programId, undefined);
      await navigate(
        thenGoToTracker ? { to: '/app/tracker/$programId', params: { programId } } : { to: '/app' }
      );
    } catch (error) {
      captureError(error);
      setIsStarting(false);
    }
  };

  if (isGuest && !guestWallSeen) {
    return (
      <Shell>
        <GuestWall
          onCreateAccount={() => void navigate({ to: '/login' })}
          onContinueAsGuest={() => setGuestWallSeen(true)}
        />
      </Shell>
    );
  }

  if (catalogQuery.isLoading) return <AppSkeleton />;

  const selectedEntry = catalogQuery.data?.find((e) => e.id === programId) ?? null;
  const notes = {
    program: selectedEntry?.name ?? '',
    weights: t('onboarding.weights.ready', {
      filled: fields.filter((f) => weights[f.key] !== undefined).length,
      total: fields.length,
    }),
  };

  return (
    <Shell>
      <StartStepper current={step} notes={step === 'program' ? {} : notes} />

      {step === 'program' && (
        <StepProgram
          entries={catalogQuery.data ?? []}
          selectedId={programId}
          onSelect={(id) => {
            setProgramId(id);
            setWeights({});
          }}
          onContinue={() => setStep('weights')}
        />
      )}

      {step === 'weights' &&
        (definition === undefined ? (
          <AppSkeleton />
        ) : (
          <StepWeights
            fields={fields}
            values={weights}
            onChange={(key, weight) => setWeights((prev) => ({ ...prev, [key]: weight }))}
            onBack={() => setStep('program')}
            onContinue={() => setStep('first-day')}
          />
        ))}

      {step === 'first-day' &&
        (definition === undefined || firstWorkout === null ? (
          <AppSkeleton />
        ) : (
          <StepFirstDay
            definition={definition}
            firstWorkout={firstWorkout}
            cycleDayNames={definition.days.map((d) => d.name)}
            isGenerating={isStarting || target.isGenerating}
            onStart={() => void generate(true)}
            onSaveForLater={() => void generate(false)}
            onBack={() => setStep('weights')}
          />
        ))}
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8 sm:py-16">{children}</div>;
}
