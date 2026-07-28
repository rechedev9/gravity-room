import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@gzclp/domain';

import {
  captureAuthorizedSession,
  isAuthorizedSessionCurrent,
  type AuthorizedSession,
} from '../../lib/auth/session';
import {
  commitProgramCatalogRefresh,
  commitProgramSummariesRefresh,
  listProgramSummaries,
  readPendingDeleteReconciliations,
  readPendingManageReconciliations,
  readProgramCatalogSnapshot,
  readProgramLibrarySnapshot,
  type ProgramManageExpectation,
  type ProgramStatus,
  type ProgramSummary,
} from '../../lib/programs/program-repository';
import {
  abandonProgramRefreshLease,
  captureProgramRefreshLease,
  isProgramRefreshLeaseCurrent,
  type ProgramRefreshLease,
  withProgramRefreshCommitBarrier,
} from '../../lib/programs/program-refresh-generation';
import { localizeCatalogEntry } from '../../lib/programs/program-content';
import {
  deleteProgram,
  manageProgram,
  reconcilePendingProgramManagement,
  verifyPendingProgramDelete,
} from '../../lib/programs/program-use-cases';
import {
  fetchCatalogEntries,
  fetchProgramSummaries,
  type ProgramManagementMutation,
} from '../../lib/programs/program-service';
import {
  readTrackerProgramId,
  writeTrackerProgramId,
} from '../../lib/tracker/tracker-selection-storage';
import { EmptyState } from '../../ui/empty-state';
import { colors, radii, spacing } from '../../ui/tokens';

function observeRefreshLease(
  promise: Promise<ProgramRefreshLease>
): Promise<PromiseSettledResult<ProgramRefreshLease>> {
  return Promise.resolve(promise).then(
    (value) => ({ status: 'fulfilled', value }),
    (reason: unknown) => ({ status: 'rejected', reason })
  );
}

async function readObservedRefreshLease(
  promise: Promise<PromiseSettledResult<ProgramRefreshLease>>
): Promise<ProgramRefreshLease> {
  const result = await promise;
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}

function abandonObservedRefreshLease(
  promise: Promise<PromiseSettledResult<ProgramRefreshLease>>
): void {
  void promise.then((result) => {
    if (result.status === 'fulfilled') {
      void abandonProgramRefreshLease(result.value);
    }
  });
}

type ResourceState<T> =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly data: readonly T[];
      readonly freshness: 'cached' | 'revalidating' | 'fresh' | 'offline' | 'partial';
    }
  | { readonly status: 'error'; readonly reason: 'cache_error' | 'no_snapshot' };

interface ProgramsScreenProps {
  readonly ownerUserId: string;
  readonly onOpenPreset: (programId: string) => void;
  readonly onOpenProgram: (programInstanceId: string) => void;
  readonly refreshRevision?: number;
}

interface ProgramOperation {
  readonly ownerUserId: string;
  readonly programInstanceId: string;
}

interface ActionButtonProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

function ActionButton({
  destructive = false,
  disabled = false,
  label,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        destructive ? styles.destructiveAction : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.actionLabel, destructive ? styles.destructiveLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ProgramCardProps {
  readonly actionsDisabled: boolean;
  readonly busy: boolean;
  readonly isPinned: boolean;
  readonly legacyRecoveryBlocked: boolean;
  readonly pendingDelete: boolean;
  readonly onDelete: () => void;
  readonly onManage: (mutation: ProgramManagementMutation) => void;
  readonly onOpen: () => void;
  readonly onPin: () => void;
  readonly onVerifyPendingDelete: () => void;
  readonly program: ProgramSummary;
  readonly pendingExpectation: ProgramManageExpectation | null;
}

function ProgramCard({
  actionsDisabled,
  busy,
  isPinned,
  legacyRecoveryBlocked,
  pendingDelete,
  onDelete,
  onManage,
  onOpen,
  onPin,
  onVerifyPendingDelete,
  pendingExpectation,
  program,
}: ProgramCardProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(program.title);

  function submitRename(): void {
    const nextName = name.trim();
    if (nextName.length === 0) return;
    onManage({ type: 'rename', name: nextName });
    setRenaming(false);
  }

  function pendingDescription(expectation: ProgramManageExpectation): string {
    if (expectation.type === 'rename') {
      return t('programs.recovery.rename', { name: expectation.name });
    }
    if (expectation.type === 'set_status') {
      return t(`programs.recovery.status.${expectation.status}`);
    }
    return t('programs.recovery.config', {
      values: JSON.stringify(expectation.config),
    });
  }

  return (
    <View style={styles.programCard}>
      <View style={styles.cardHeading}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{program.title}</Text>
          <Text style={styles.cardMeta}>
            {t('programs.card_updated', { date: program.updatedAt.slice(0, 10) })}
          </Text>
        </View>
        {isPinned ? <Text style={styles.pinnedBadge}>{t('programs.pinned.badge')}</Text> : null}
      </View>

      {renaming ? (
        <View style={styles.renameBlock}>
          <TextInput
            accessibilityLabel={t('programs.actions.rename_accessibility', {
              name: program.title,
            })}
            autoFocus
            maxLength={100}
            onChangeText={setName}
            style={styles.renameInput}
            value={name}
          />
          <View style={styles.actions}>
            <ActionButton label={t('common.save')} onPress={submitRename} />
            <ActionButton
              label={t('common.cancel')}
              onPress={() => {
                setName(program.title);
                setRenaming(false);
              }}
            />
          </View>
        </View>
      ) : (
        <>
          {pendingDelete || legacyRecoveryBlocked ? (
            <View accessibilityRole="alert" style={styles.recoveryBlock}>
              <Text style={styles.recoveryText}>
                {t(pendingDelete ? 'programs.recovery.pending_delete' : 'programs.recovery.legacy')}
              </Text>
              <View style={styles.actions}>
                <ActionButton
                  destructive
                  disabled={actionsDisabled}
                  label={t('programs.actions.delete')}
                  onPress={onDelete}
                />
                {pendingDelete ? (
                  <ActionButton
                    disabled={actionsDisabled}
                    label={t('programs.recovery.check_delete')}
                    onPress={onVerifyPendingDelete}
                  />
                ) : null}
              </View>
            </View>
          ) : pendingExpectation ? (
            <View accessibilityRole="alert" style={styles.recoveryBlock}>
              <Text style={styles.recoveryText}>{pendingDescription(pendingExpectation)}</Text>
              <View
                accessibilityElementsHidden={actionsDisabled}
                importantForAccessibility={actionsDisabled ? 'no-hide-descendants' : 'auto'}
                pointerEvents={actionsDisabled ? 'none' : 'auto'}
                style={[styles.actions, actionsDisabled ? styles.disabled : null]}
              >
                <ActionButton
                  disabled={actionsDisabled}
                  label={t('programs.recovery.retry')}
                  onPress={() => onManage(pendingExpectation)}
                />
                <ActionButton
                  destructive
                  disabled={actionsDisabled}
                  label={t('programs.actions.delete')}
                  onPress={onDelete}
                />
              </View>
            </View>
          ) : (
            <View
              accessibilityElementsHidden={actionsDisabled}
              importantForAccessibility={actionsDisabled ? 'no-hide-descendants' : 'auto'}
              pointerEvents={actionsDisabled ? 'none' : 'auto'}
              style={[styles.actions, actionsDisabled ? styles.disabled : null]}
            >
              {program.status === 'active' ? (
                <>
                  <ActionButton label={t('programs.actions.open')} onPress={onOpen} />
                  {!isPinned ? (
                    <ActionButton label={t('programs.actions.pin')} onPress={onPin} />
                  ) : null}
                  <ActionButton
                    label={t('programs.actions.complete')}
                    onPress={() => onManage({ type: 'set_status', status: 'completed' })}
                  />
                  <ActionButton
                    label={t('programs.actions.archive')}
                    onPress={() => onManage({ type: 'set_status', status: 'archived' })}
                  />
                </>
              ) : null}
              {program.status === 'completed' ? (
                <>
                  <ActionButton
                    label={t('programs.actions.reactivate')}
                    onPress={() => onManage({ type: 'set_status', status: 'active' })}
                  />
                  <ActionButton
                    label={t('programs.actions.archive')}
                    onPress={() => onManage({ type: 'set_status', status: 'archived' })}
                  />
                </>
              ) : null}
              {program.status === 'archived' ? (
                <ActionButton
                  label={t('programs.actions.reactivate')}
                  onPress={() => onManage({ type: 'set_status', status: 'active' })}
                />
              ) : null}
              <ActionButton
                label={t('programs.actions.rename')}
                onPress={() => setRenaming(true)}
              />
              <ActionButton destructive label={t('programs.actions.delete')} onPress={onDelete} />
            </View>
          )}
        </>
      )}
      {busy ? (
        <ActivityIndicator
          accessibilityLabel={t('programs.action_busy', { name: program.title })}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          color={colors.textPrimary}
        />
      ) : null}
    </View>
  );
}

interface ProgramSectionProps {
  readonly busyProgramId: string | null;
  readonly legacyRecoveryProgramIds: ReadonlySet<string>;
  readonly managementDisabled: boolean;
  readonly onDelete: (program: ProgramSummary) => void;
  readonly onManage: (program: ProgramSummary, mutation: ProgramManagementMutation) => void;
  readonly onOpen: (program: ProgramSummary) => void;
  readonly onPin: (program: ProgramSummary) => void;
  readonly onVerifyPendingDelete: (program: ProgramSummary) => void;
  readonly pendingDeleteProgramIds: ReadonlySet<string>;
  readonly pinnedProgramId: string | null;
  readonly programs: readonly ProgramSummary[];
  readonly pendingExpectations: ReadonlyMap<string, ProgramManageExpectation>;
  readonly status: ProgramStatus;
}

function ProgramSection({
  busyProgramId,
  legacyRecoveryProgramIds,
  managementDisabled,
  onDelete,
  onManage,
  onOpen,
  onPin,
  onVerifyPendingDelete,
  pendingDeleteProgramIds,
  pinnedProgramId,
  pendingExpectations,
  programs,
  status,
}: ProgramSectionProps) {
  const { t } = useTranslation();
  const matching = programs.filter((program) => program.status === status);

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {t(`programs.sections.${status}`, { count: matching.length })}
      </Text>
      {matching.length === 0 ? (
        <Text style={styles.emptySection}>{t(`programs.sections.${status}_empty`)}</Text>
      ) : (
        matching.map((program) => (
          <ProgramCard
            actionsDisabled={busyProgramId !== null || managementDisabled}
            busy={busyProgramId === program.id}
            isPinned={pinnedProgramId === program.id}
            key={program.id}
            legacyRecoveryBlocked={legacyRecoveryProgramIds.has(program.id)}
            onDelete={() => onDelete(program)}
            onManage={(mutation) => onManage(program, mutation)}
            onOpen={() => onOpen(program)}
            onPin={() => onPin(program)}
            onVerifyPendingDelete={() => onVerifyPendingDelete(program)}
            pendingDelete={pendingDeleteProgramIds.has(program.id)}
            pendingExpectation={
              pendingDeleteProgramIds.has(program.id)
                ? null
                : (pendingExpectations.get(program.id) ?? null)
            }
            program={program}
          />
        ))
      )}
    </View>
  );
}

export function ProgramsScreen({
  onOpenPreset,
  onOpenProgram,
  ownerUserId,
  refreshRevision = 0,
}: ProgramsScreenProps) {
  const { t } = useTranslation();
  const [libraryState, setLibraryState] = useState<{
    readonly ownerUserId: string;
    readonly value: ResourceState<ProgramSummary>;
  }>({ ownerUserId, value: { status: 'loading' } });
  const [catalogState, setCatalogState] = useState<{
    readonly ownerUserId: string;
    readonly value: ResourceState<CatalogEntry>;
  }>({ ownerUserId, value: { status: 'loading' } });
  const [pinnedState, setPinnedState] = useState<{
    readonly ownerUserId: string;
    readonly value: string | null;
  }>({ ownerUserId, value: null });
  const [pendingExpectationState, setPendingExpectationState] = useState<{
    readonly ownerUserId: string;
    readonly status: 'loading' | 'ready' | 'error';
    readonly values: ReadonlyMap<string, ProgramManageExpectation>;
    readonly legacyProgramIds: ReadonlySet<string>;
    readonly deleteProgramIds: ReadonlySet<string>;
  }>({
    ownerUserId,
    status: 'loading',
    values: new Map(),
    legacyProgramIds: new Set(),
    deleteProgramIds: new Set(),
  });
  const library =
    libraryState.ownerUserId === ownerUserId
      ? libraryState.value
      : ({ status: 'loading' } as const);
  const catalog =
    catalogState.ownerUserId === ownerUserId
      ? catalogState.value
      : ({ status: 'loading' } as const);
  const pinnedProgramId = pinnedState.ownerUserId === ownerUserId ? pinnedState.value : null;
  const recoveryMetadataReady =
    pendingExpectationState.ownerUserId === ownerUserId &&
    pendingExpectationState.status === 'ready';
  const recoveryMetadataError =
    pendingExpectationState.ownerUserId === ownerUserId &&
    pendingExpectationState.status === 'error';
  const pendingExpectations = recoveryMetadataReady
    ? pendingExpectationState.values
    : new Map<string, ProgramManageExpectation>();
  const legacyRecoveryProgramIds = recoveryMetadataReady
    ? pendingExpectationState.legacyProgramIds
    : new Set<string>();
  const pendingDeleteProgramIds = recoveryMetadataReady
    ? pendingExpectationState.deleteProgramIds
    : new Set<string>();
  function setLibrary(value: ResourceState<ProgramSummary>): void {
    setLibraryState({ ownerUserId, value });
  }
  function setCatalog(value: ResourceState<CatalogEntry>): void {
    setCatalogState({ ownerUserId, value });
  }
  function setPinnedProgramId(value: string | null): void {
    setPinnedState({ ownerUserId, value });
  }
  function setPendingReconciliations(
    entries: Awaited<ReturnType<typeof readPendingManageReconciliations>>,
    deleteProgramIds: Awaited<ReturnType<typeof readPendingDeleteReconciliations>>
  ): void {
    setPendingExpectationState({
      ownerUserId,
      status: 'ready',
      values: new Map(
        entries.flatMap((entry) =>
          entry.expectation === null ? [] : [[entry.programInstanceId, entry.expectation] as const]
        )
      ),
      legacyProgramIds: new Set(
        entries.flatMap((entry) => (entry.expectation === null ? [entry.programInstanceId] : []))
      ),
      deleteProgramIds: new Set(deleteProgramIds),
    });
  }
  function setPendingReconciliationError(): void {
    setPendingExpectationState({
      ownerUserId,
      status: 'error',
      values: new Map(),
      legacyProgramIds: new Set(),
      deleteProgramIds: new Set(),
    });
  }
  async function readRecoveryMetadata(targetOwnerUserId = ownerUserId) {
    try {
      const [entries, deleteProgramIds] = await Promise.all([
        readPendingManageReconciliations(targetOwnerUserId),
        readPendingDeleteReconciliations(targetOwnerUserId),
      ]);
      return {
        status: 'ready' as const,
        entries,
        deleteProgramIds,
      };
    } catch {
      return { status: 'error' as const };
    }
  }
  const [reloadToken, setReloadToken] = useState(0);
  const [busyOperation, setBusyOperation] = useState<ProgramOperation | null>(null);
  const [mutationNoticeState, setMutationNoticeState] = useState<{
    readonly ownerUserId: string;
    readonly value: 'remote_error' | 'reconciliation_required';
  } | null>(null);
  const currentOwnerUserIdRef = useRef(ownerUserId);
  currentOwnerUserIdRef.current = ownerUserId;
  const operationInProgressRef = useRef<ProgramOperation | null>(null);
  const operationOwnerUserIdRef = useRef(ownerUserId);
  if (operationOwnerUserIdRef.current !== ownerUserId) {
    operationOwnerUserIdRef.current = ownerUserId;
    operationInProgressRef.current = null;
  }
  const busyProgramId =
    busyOperation?.ownerUserId === ownerUserId && operationInProgressRef.current === busyOperation
      ? busyOperation.programInstanceId
      : null;
  const mutationNotice =
    mutationNoticeState?.ownerUserId === ownerUserId ? mutationNoticeState.value : null;

  useEffect(() => {
    let active = true;
    setPendingExpectationState({
      ownerUserId,
      status: 'loading',
      values: new Map(),
      legacyProgramIds: new Set(),
      deleteProgramIds: new Set(),
    });
    let session: AuthorizedSession;
    let libraryLeasePromise: Promise<PromiseSettledResult<ProgramRefreshLease>>;
    let catalogLeasePromise: Promise<PromiseSettledResult<ProgramRefreshLease>>;
    try {
      session = captureAuthorizedSession(ownerUserId);
      libraryLeasePromise = observeRefreshLease(
        captureProgramRefreshLease(ownerUserId, 'library', session)
      );
      catalogLeasePromise = observeRefreshLease(
        captureProgramRefreshLease(ownerUserId, 'catalog', session)
      );
    } catch {
      setLibrary({ status: 'error', reason: 'no_snapshot' });
      setCatalog({ status: 'error', reason: 'no_snapshot' });
      return () => {
        active = false;
      };
    }

    async function loadLibrary(): Promise<void> {
      let cached: ProgramSummary[] = [];
      let cacheAvailable = false;
      let partialCacheAvailable = false;
      let cacheReadFailed = false;
      try {
        const [snapshot, pendingResult] = await Promise.all([
          readProgramLibrarySnapshot(ownerUserId),
          readRecoveryMetadata(),
          readTrackerProgramId(ownerUserId).then((id) => {
            if (active) setPinnedProgramId(id);
          }),
        ]);
        if (active) {
          if (pendingResult.status === 'ready') {
            setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
          } else {
            setPendingReconciliationError();
          }
        }
        cached = [...snapshot.data];
        if (snapshot.status === 'no_snapshot') {
          partialCacheAvailable = cached.length > 0;
        } else {
          cacheAvailable = true;
        }
        if (active && cacheAvailable) {
          setLibrary({ status: 'ready', data: cached, freshness: 'cached' });
          setLibrary({ status: 'ready', data: cached, freshness: 'revalidating' });
        } else if (active && partialCacheAvailable) {
          setLibrary({ status: 'ready', data: cached, freshness: 'partial' });
        }
      } catch {
        cached = [];
        cacheReadFailed = true;
      }

      let libraryLease: ProgramRefreshLease | null = null;
      try {
        libraryLease = await readObservedRefreshLease(libraryLeasePromise);
        const remote = await fetchProgramSummaries(session);
        const committed = await commitProgramSummariesRefresh(libraryLease, remote);
        if (!committed) {
          await withProgramRefreshCommitBarrier(ownerUserId, 'library', async () => {
            const [winningSnapshot, winningPinnedProgramId, pendingResult] = await Promise.all([
              readProgramLibrarySnapshot(ownerUserId),
              readTrackerProgramId(ownerUserId),
              readRecoveryMetadata(),
            ]);
            if (active && isAuthorizedSessionCurrent(session)) {
              setPinnedProgramId(winningPinnedProgramId);
              if (pendingResult.status === 'ready') {
                setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
              } else {
                setPendingReconciliationError();
              }
              if (winningSnapshot.status === 'no_snapshot') {
                setLibrary(
                  winningSnapshot.data.length > 0
                    ? { status: 'ready', data: [...winningSnapshot.data], freshness: 'partial' }
                    : { status: 'error', reason: 'no_snapshot' }
                );
              } else {
                setLibrary({
                  status: 'ready',
                  data: [...winningSnapshot.data],
                  freshness: 'cached',
                });
              }
            }
          });
          return;
        }
        const remoteProgramInstanceIds = remote.map((program) => program.id);
        await reconcilePendingProgramManagement(ownerUserId, remoteProgramInstanceIds).catch(
          () => undefined
        );
        await withProgramRefreshCommitBarrier(ownerUserId, 'library', async () => {
          const [refreshed, pinned, pendingResult] = await Promise.all([
            listProgramSummaries(ownerUserId),
            readTrackerProgramId(ownerUserId),
            readRecoveryMetadata(),
          ]);
          if (active && isAuthorizedSessionCurrent(session)) {
            setLibrary({ status: 'ready', data: refreshed, freshness: 'fresh' });
            setPinnedProgramId(pinned);
            if (pendingResult.status === 'ready') {
              setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
            } else {
              setPendingReconciliationError();
            }
          }
        });
      } catch {
        if (!active || !isAuthorizedSessionCurrent(session)) return;
        try {
          await withProgramRefreshCommitBarrier(ownerUserId, 'library', async () => {
            const [currentSnapshot, currentPinnedProgramId, pendingResult] = await Promise.all([
              readProgramLibrarySnapshot(ownerUserId),
              readTrackerProgramId(ownerUserId),
              readRecoveryMetadata(),
            ]);
            if (!active || !isAuthorizedSessionCurrent(session)) return;
            setPinnedProgramId(currentPinnedProgramId);
            if (pendingResult.status === 'ready') {
              setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
            } else {
              setPendingReconciliationError();
            }
            setLibrary(
              currentSnapshot.status === 'no_snapshot'
                ? currentSnapshot.data.length > 0
                  ? { status: 'ready', data: [...currentSnapshot.data], freshness: 'partial' }
                  : { status: 'error', reason: 'no_snapshot' }
                : { status: 'ready', data: [...currentSnapshot.data], freshness: 'offline' }
            );
          });
        } catch {
          if (!active || !isAuthorizedSessionCurrent(session)) return;
          if (libraryLease !== null && !isProgramRefreshLeaseCurrent(libraryLease)) {
            setLibrary({ status: 'error', reason: 'cache_error' });
            return;
          }
          setLibrary(
            cacheAvailable
              ? { status: 'ready', data: cached, freshness: 'offline' }
              : partialCacheAvailable
                ? { status: 'ready', data: cached, freshness: 'partial' }
                : { status: 'error', reason: cacheReadFailed ? 'cache_error' : 'no_snapshot' }
          );
        }
      } finally {
        if (libraryLease !== null) {
          await abandonProgramRefreshLease(libraryLease);
        }
      }
    }

    async function loadCatalog(): Promise<void> {
      let cached: CatalogEntry[] = [];
      let cacheAvailable = false;
      let cacheReadFailed = false;
      try {
        const snapshot = await readProgramCatalogSnapshot(ownerUserId);
        if (snapshot.status !== 'no_snapshot') {
          cached = [...snapshot.data];
          cacheAvailable = true;
        }
        if (active && cacheAvailable) {
          setCatalog({ status: 'ready', data: cached, freshness: 'cached' });
          setCatalog({ status: 'ready', data: cached, freshness: 'revalidating' });
        }
      } catch {
        cached = [];
        cacheReadFailed = true;
      }

      let catalogLease: ProgramRefreshLease | null = null;
      try {
        catalogLease = await readObservedRefreshLease(catalogLeasePromise);
        const settledCatalogLease = catalogLease;
        const remote = await fetchCatalogEntries(session);
        const committed = await commitProgramCatalogRefresh(settledCatalogLease, remote);
        await withProgramRefreshCommitBarrier(ownerUserId, 'catalog', async () => {
          const leaseStillCurrent = committed && isProgramRefreshLeaseCurrent(settledCatalogLease);
          const winningSnapshot = leaseStillCurrent
            ? null
            : await readProgramCatalogSnapshot(ownerUserId);
          if (active && isAuthorizedSessionCurrent(session)) {
            if (winningSnapshot === null) {
              setCatalog({ status: 'ready', data: remote, freshness: 'fresh' });
            } else if (winningSnapshot.status === 'no_snapshot') {
              setCatalog(
                winningSnapshot.data.length > 0
                  ? {
                      status: 'ready',
                      data: [...winningSnapshot.data],
                      freshness: 'partial',
                    }
                  : { status: 'error', reason: 'no_snapshot' }
              );
            } else {
              setCatalog({
                status: 'ready',
                data: [...winningSnapshot.data],
                freshness: 'cached',
              });
            }
          }
        });
      } catch {
        try {
          await withProgramRefreshCommitBarrier(ownerUserId, 'catalog', async () => {
            if (!active || !isAuthorizedSessionCurrent(session)) return;
            if (catalogLease !== null && !isProgramRefreshLeaseCurrent(catalogLease)) {
              const winningSnapshot = await readProgramCatalogSnapshot(ownerUserId);
              if (winningSnapshot.status === 'no_snapshot') {
                setCatalog(
                  winningSnapshot.data.length > 0
                    ? {
                        status: 'ready',
                        data: [...winningSnapshot.data],
                        freshness: 'partial',
                      }
                    : { status: 'error', reason: 'no_snapshot' }
                );
              } else {
                setCatalog({
                  status: 'ready',
                  data: [...winningSnapshot.data],
                  freshness: 'cached',
                });
              }
              return;
            }
            setCatalog(
              cacheAvailable
                ? { status: 'ready', data: cached, freshness: 'offline' }
                : { status: 'error', reason: cacheReadFailed ? 'cache_error' : 'no_snapshot' }
            );
          });
        } catch {
          if (active && isAuthorizedSessionCurrent(session)) {
            setCatalog({ status: 'error', reason: 'cache_error' });
          }
        }
      } finally {
        if (catalogLease !== null) {
          await abandonProgramRefreshLease(catalogLease);
        }
      }
    }

    setLibrary({ status: 'loading' });
    setCatalog({ status: 'loading' });
    void Promise.all([loadLibrary(), loadCatalog()]);

    return () => {
      active = false;
      abandonObservedRefreshLease(libraryLeasePromise);
      abandonObservedRefreshLease(catalogLeasePromise);
    };
  }, [ownerUserId, refreshRevision, reloadToken]);

  function isCurrentOperation(operation: ProgramOperation): boolean {
    return (
      operationInProgressRef.current === operation &&
      currentOwnerUserIdRef.current === operation.ownerUserId
    );
  }

  function beginOperation(programInstanceId: string): ProgramOperation | null {
    if (operationInProgressRef.current?.ownerUserId === ownerUserId || !recoveryMetadataReady) {
      return null;
    }
    const operation = { ownerUserId, programInstanceId };
    operationInProgressRef.current = operation;
    setBusyOperation(operation);
    setMutationNoticeState(null);
    return operation;
  }

  function finishOperation(operation: ProgramOperation): void {
    if (operationInProgressRef.current !== operation) return;
    operationInProgressRef.current = null;
    setBusyOperation(null);
  }

  function setMutationNoticeForOperation(
    operation: ProgramOperation,
    value: 'remote_error' | 'reconciliation_required'
  ): void {
    if (!isCurrentOperation(operation)) return;
    setMutationNoticeState({ ownerUserId: operation.ownerUserId, value });
  }

  async function refreshLocalLibrary(operation: ProgramOperation): Promise<void> {
    const [programs, pinned, pendingResult] = await Promise.all([
      listProgramSummaries(operation.ownerUserId),
      readTrackerProgramId(operation.ownerUserId),
      readRecoveryMetadata(operation.ownerUserId),
    ]);
    if (!isCurrentOperation(operation)) return;
    setLibrary({ status: 'ready', data: programs, freshness: 'fresh' });
    setPinnedProgramId(pinned);
    if (pendingResult.status === 'ready') {
      setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
    } else {
      setPendingReconciliationError();
    }
  }

  async function handleManage(
    program: ProgramSummary,
    mutation: ProgramManagementMutation
  ): Promise<void> {
    const operation = beginOperation(program.id);
    if (operation === null) return;
    try {
      const result = await manageProgram({
        ownerUserId: operation.ownerUserId,
        programInstanceId: program.id,
        mutation,
      });
      if (!isCurrentOperation(operation)) return;
      if (result.status === 'reconciliation_required') {
        setMutationNoticeForOperation(operation, 'reconciliation_required');
        setReloadToken((current) => current + 1);
      } else {
        await refreshLocalLibrary(operation);
      }
    } catch {
      const pendingResult = await readRecoveryMetadata(operation.ownerUserId);
      if (isCurrentOperation(operation)) {
        if (pendingResult.status === 'ready') {
          setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
        } else {
          setPendingReconciliationError();
        }
      }
      setMutationNoticeForOperation(operation, 'remote_error');
    } finally {
      finishOperation(operation);
    }
  }

  async function handlePin(program: ProgramSummary): Promise<boolean> {
    const operation = beginOperation(program.id);
    if (operation === null) return false;
    try {
      await writeTrackerProgramId(operation.ownerUserId, program.id);
      if (!isCurrentOperation(operation)) return false;
      setPinnedProgramId(program.id);
      return true;
    } catch {
      setMutationNoticeForOperation(operation, 'remote_error');
      return false;
    } finally {
      finishOperation(operation);
    }
  }

  async function handleOpen(program: ProgramSummary): Promise<void> {
    const pinned = await handlePin(program);
    if (pinned) {
      onOpenProgram(program.id);
    }
  }

  async function performDelete(program: ProgramSummary): Promise<void> {
    const operation = beginOperation(program.id);
    if (operation === null) return;
    try {
      const result = await deleteProgram({
        ownerUserId: operation.ownerUserId,
        programInstanceId: program.id,
      });
      if (!isCurrentOperation(operation)) return;
      if (result.status === 'reconciliation_required') {
        setMutationNoticeForOperation(operation, 'reconciliation_required');
        setReloadToken((current) => current + 1);
      } else {
        await refreshLocalLibrary(operation);
      }
    } catch {
      const pendingResult = await readRecoveryMetadata(operation.ownerUserId);
      if (isCurrentOperation(operation)) {
        if (pendingResult.status === 'ready') {
          setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
        } else {
          setPendingReconciliationError();
        }
      }
      setMutationNoticeForOperation(operation, 'remote_error');
    } finally {
      finishOperation(operation);
    }
  }

  async function handleVerifyPendingDelete(program: ProgramSummary): Promise<void> {
    const operation = beginOperation(program.id);
    if (operation === null) return;
    try {
      const result = await verifyPendingProgramDelete({
        ownerUserId: operation.ownerUserId,
        programInstanceId: program.id,
      });
      if (result === 'resolved_absent') {
        setPendingExpectationState((current) => {
          if (current.ownerUserId !== operation.ownerUserId || current.status !== 'ready') {
            return current;
          }
          const deleteProgramIds = new Set(current.deleteProgramIds);
          deleteProgramIds.delete(program.id);
          return { ...current, deleteProgramIds };
        });
        await refreshLocalLibrary(operation);
      }
    } catch {
      const pendingResult = await readRecoveryMetadata(operation.ownerUserId);
      if (isCurrentOperation(operation)) {
        if (pendingResult.status === 'ready') {
          setPendingReconciliations(pendingResult.entries, pendingResult.deleteProgramIds);
        } else {
          setPendingReconciliationError();
        }
      }
      setMutationNoticeForOperation(operation, 'remote_error');
    } finally {
      finishOperation(operation);
    }
  }

  function confirmDelete(program: ProgramSummary): void {
    Alert.alert(
      t('programs.delete_confirm.title'),
      t('programs.delete_confirm.body', { name: program.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('programs.actions.delete'),
          style: 'destructive',
          onPress: () => {
            void performDelete(program);
          },
        },
      ]
    );
  }

  const programs = library.status === 'ready' ? library.data : [];
  const pinnedProgram = programs.find((program) => program.id === pinnedProgramId) ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('programs.eyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('programs.title')}
        </Text>
        <Text style={styles.body}>{t('programs.body')}</Text>

        {mutationNotice ? (
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
            {t(
              mutationNotice === 'reconciliation_required'
                ? 'programs.reconciliation_required'
                : 'programs.errors.mutation'
            )}
          </Text>
        ) : null}

        {library.status === 'loading' ? (
          <ActivityIndicator
            accessibilityLabel={t('programs.loading_library')}
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            color={colors.textPrimary}
          />
        ) : null}
        {library.status === 'error' ? (
          <View style={styles.stateBlock}>
            <Text
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              style={styles.error}
            >
              {t(
                library.reason === 'no_snapshot'
                  ? 'programs.errors.first_library_sync'
                  : 'programs.errors.sync'
              )}
            </Text>
            <ActionButton
              label={t('common.retry')}
              onPress={() => setReloadToken((current) => current + 1)}
            />
          </View>
        ) : null}
        {library.status === 'ready' ? (
          <>
            {library.freshness === 'offline' ? (
              <View accessibilityRole="alert" style={styles.offlineBanner}>
                <Text style={styles.offlineText}>{t('programs.offline_library')}</Text>
              </View>
            ) : null}
            {library.freshness === 'partial' ? (
              <View accessibilityRole="alert" style={styles.offlineBanner}>
                <Text style={styles.offlineText}>{t('programs.partial_library')}</Text>
              </View>
            ) : null}
            {library.freshness === 'cached' || library.freshness === 'revalidating' ? (
              <View accessibilityLiveRegion="polite" style={styles.cachedBanner}>
                <Text style={styles.cachedText}>{t('programs.sync_notice')}</Text>
              </View>
            ) : null}
            {recoveryMetadataError ? (
              <View accessibilityRole="alert" style={styles.offlineBanner}>
                <Text style={styles.offlineText}>
                  {t('programs.recovery.metadata_unavailable')}
                </Text>
                <ActionButton
                  label={t('common.retry')}
                  onPress={() => setReloadToken((current) => current + 1)}
                />
              </View>
            ) : null}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {t('programs.pinned.title')}
              </Text>
              {pinnedProgram ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    !recoveryMetadataReady ||
                    busyProgramId !== null ||
                    pendingExpectations.has(pinnedProgram.id) ||
                    legacyRecoveryProgramIds.has(pinnedProgram.id) ||
                    pendingDeleteProgramIds.has(pinnedProgram.id)
                  }
                  onPress={() => {
                    void handleOpen(pinnedProgram);
                  }}
                  style={styles.pinnedCard}
                >
                  <Text style={styles.cardTitle}>{pinnedProgram.title}</Text>
                  <Text style={styles.cardMeta}>{t('programs.pinned.body')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.emptySection}>{t('programs.pinned.empty')}</Text>
              )}
            </View>
            {(['active', 'completed', 'archived'] as const).map((status) => (
              <ProgramSection
                busyProgramId={busyProgramId}
                key={status}
                legacyRecoveryProgramIds={legacyRecoveryProgramIds}
                managementDisabled={!recoveryMetadataReady}
                onDelete={confirmDelete}
                onManage={(program, mutation) => {
                  void handleManage(program, mutation);
                }}
                onOpen={(program) => {
                  void handleOpen(program);
                }}
                onPin={(program) => {
                  void handlePin(program);
                }}
                onVerifyPendingDelete={(program) => {
                  void handleVerifyPendingDelete(program);
                }}
                pendingDeleteProgramIds={pendingDeleteProgramIds}
                pendingExpectations={pendingExpectations}
                pinnedProgramId={pinnedProgramId}
                programs={programs}
                status={status}
              />
            ))}
          </>
        ) : null}

        <View style={styles.catalogSection}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('programs.catalog_title')}
          </Text>
          {catalog.status === 'loading' ? (
            <ActivityIndicator
              accessibilityLabel={t('programs.loading_catalog')}
              accessibilityLiveRegion="polite"
              accessibilityRole="progressbar"
              color={colors.textPrimary}
            />
          ) : null}
          {catalog.status === 'error' ? (
            <View style={styles.stateBlock}>
              <Text
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
                style={styles.error}
              >
                {t(
                  catalog.reason === 'no_snapshot'
                    ? 'programs.errors.first_catalog_sync'
                    : 'programs.errors.catalog'
                )}
              </Text>
              <ActionButton
                label={t('common.retry')}
                onPress={() => setReloadToken((current) => current + 1)}
              />
            </View>
          ) : null}
          {catalog.status === 'ready' ? (
            <>
              {catalog.freshness === 'offline' ? (
                <View accessibilityRole="alert" style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>{t('programs.offline_catalog')}</Text>
                </View>
              ) : null}
              {catalog.freshness === 'cached' || catalog.freshness === 'revalidating' ? (
                <View accessibilityLiveRegion="polite" style={styles.cachedBanner}>
                  <Text style={styles.cachedText}>{t('programs.catalog_revalidating')}</Text>
                </View>
              ) : null}
              {catalog.data.length === 0 ? (
                <EmptyState
                  body={t('programs.catalog_empty_body')}
                  title={t('programs.catalog_empty_title')}
                />
              ) : null}
              {catalog.data.map((entry) => {
                const localized = localizeCatalogEntry(entry, t);
                return (
                  <Pressable
                    accessibilityLabel={t('programs.catalog_open_accessibility', {
                      name: localized.name,
                    })}
                    accessibilityRole="button"
                    key={entry.id}
                    onPress={() => onOpenPreset(entry.id)}
                    style={styles.catalogCard}
                  >
                    <Text style={styles.cardTitle}>{localized.name}</Text>
                    <Text style={styles.cardMeta}>{localized.description}</Text>
                    <Text style={styles.catalogMeta}>
                      {t('programs.catalog_meta', {
                        level: localized.level,
                        total: entry.totalWorkouts,
                        perWeek: entry.workoutsPerWeek,
                      })}
                    </Text>
                    <Text style={styles.catalogAction}>{t('programs.catalog_open')}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    gap: spacing.stackLarge,
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    paddingBottom: 40,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    gap: spacing.stack,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  emptySection: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  programCard: {
    gap: spacing.stack,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
  cardHeading: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pinnedBadge: {
    alignSelf: 'flex-start',
    color: colors.accentSuccess,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pinnedCard: {
    minHeight: 64,
    justifyContent: 'center',
    gap: 4,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accentSuccess,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
  },
  destructiveAction: {
    borderColor: colors.accentDanger,
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  destructiveLabel: {
    color: colors.textError,
  },
  renameBlock: {
    gap: 8,
  },
  recoveryBlock: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: spacing.stack,
    padding: spacing.card,
  },
  recoveryText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  renameInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  stateBlock: {
    alignItems: 'flex-start',
    gap: spacing.stack,
  },
  error: {
    color: colors.textError,
    fontSize: 14,
    lineHeight: 20,
  },
  offlineBanner: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accentWarning,
    padding: spacing.card,
  },
  offlineText: {
    color: colors.accentWarning,
    fontSize: 14,
    lineHeight: 20,
  },
  cachedBanner: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.card,
  },
  cachedText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  catalogSection: {
    gap: spacing.stack,
    paddingTop: 8,
  },
  catalogCard: {
    minHeight: 44,
    gap: 6,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
  catalogMeta: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  catalogAction: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
