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
  listCachedCatalog,
  listProgramSummaries,
  replaceCachedCatalog,
  replaceProgramSummaries,
  type ProgramStatus,
  type ProgramSummary,
} from '../../lib/programs/program-repository';
import { deleteProgram, manageProgram } from '../../lib/programs/program-use-cases';
import {
  fetchCatalogEntries,
  fetchProgramSummaries,
  type ProgramManagementMutation,
} from '../../lib/programs/program-service';
import {
  readTrackerProgramId,
  writeTrackerProgramId,
} from '../../lib/tracker/tracker-selection-storage';
import { colors, radii, spacing } from '../../ui/tokens';

type ResourceState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: readonly T[]; readonly offline: boolean }
  | { readonly status: 'error' };

interface ProgramsScreenProps {
  readonly ownerUserId: string;
  readonly onOpenPreset: (programId: string) => void;
  readonly onOpenProgram: (programInstanceId: string) => void;
}

interface ActionButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

function ActionButton({ destructive = false, label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.actionButton, destructive ? styles.destructiveAction : null]}
    >
      <Text style={[styles.actionLabel, destructive ? styles.destructiveLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ProgramCardProps {
  readonly busy: boolean;
  readonly isPinned: boolean;
  readonly onDelete: () => void;
  readonly onManage: (mutation: ProgramManagementMutation) => void;
  readonly onOpen: () => void;
  readonly onPin: () => void;
  readonly program: ProgramSummary;
}

function ProgramCard({
  busy,
  isPinned,
  onDelete,
  onManage,
  onOpen,
  onPin,
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
        <View
          accessibilityElementsHidden={busy}
          importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
          style={[styles.actions, busy ? styles.disabled : null]}
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
          <ActionButton label={t('programs.actions.rename')} onPress={() => setRenaming(true)} />
          <ActionButton destructive label={t('programs.actions.delete')} onPress={onDelete} />
        </View>
      )}
      {busy ? <ActivityIndicator color={colors.textPrimary} /> : null}
    </View>
  );
}

interface ProgramSectionProps {
  readonly busyProgramId: string | null;
  readonly onDelete: (program: ProgramSummary) => void;
  readonly onManage: (program: ProgramSummary, mutation: ProgramManagementMutation) => void;
  readonly onOpen: (program: ProgramSummary) => void;
  readonly onPin: (program: ProgramSummary) => void;
  readonly pinnedProgramId: string | null;
  readonly programs: readonly ProgramSummary[];
  readonly status: ProgramStatus;
}

function ProgramSection({
  busyProgramId,
  onDelete,
  onManage,
  onOpen,
  onPin,
  pinnedProgramId,
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
            busy={busyProgramId === program.id}
            isPinned={pinnedProgramId === program.id}
            key={program.id}
            onDelete={() => onDelete(program)}
            onManage={(mutation) => onManage(program, mutation)}
            onOpen={() => onOpen(program)}
            onPin={() => onPin(program)}
            program={program}
          />
        ))
      )}
    </View>
  );
}

export function ProgramsScreen({ onOpenPreset, onOpenProgram, ownerUserId }: ProgramsScreenProps) {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<ResourceState<ProgramSummary>>({
    status: 'loading',
  });
  const [catalog, setCatalog] = useState<ResourceState<CatalogEntry>>({
    status: 'loading',
  });
  const [pinnedProgramId, setPinnedProgramId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyProgramId, setBusyProgramId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState(false);
  const operationInProgressRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadLibrary(): Promise<void> {
      let cached: ProgramSummary[] = [];
      let cacheAvailable = false;
      try {
        [cached] = await Promise.all([
          listProgramSummaries(ownerUserId),
          readTrackerProgramId(ownerUserId).then((id) => {
            if (active) setPinnedProgramId(id);
          }),
        ]);
        cacheAvailable = true;
        if (active && cached.length > 0) {
          setLibrary({ status: 'ready', data: cached, offline: false });
        }
      } catch {
        cached = [];
      }

      try {
        const remote = await fetchProgramSummaries();
        await replaceProgramSummaries(ownerUserId, remote);
        const [refreshed, pinned] = await Promise.all([
          listProgramSummaries(ownerUserId),
          readTrackerProgramId(ownerUserId),
        ]);
        if (active) {
          setLibrary({ status: 'ready', data: refreshed, offline: false });
          setPinnedProgramId(pinned);
        }
      } catch {
        if (!active) return;
        setLibrary(
          cacheAvailable ? { status: 'ready', data: cached, offline: true } : { status: 'error' }
        );
      }
    }

    async function loadCatalog(): Promise<void> {
      let cached: CatalogEntry[] = [];
      let cacheAvailable = false;
      try {
        cached = await listCachedCatalog(ownerUserId);
        cacheAvailable = true;
        if (active && cached.length > 0) {
          setCatalog({ status: 'ready', data: cached, offline: false });
        }
      } catch {
        cached = [];
      }

      try {
        const remote = await fetchCatalogEntries();
        await replaceCachedCatalog(ownerUserId, remote);
        if (active) {
          setCatalog({ status: 'ready', data: remote, offline: false });
        }
      } catch {
        if (!active) return;
        setCatalog(
          cacheAvailable ? { status: 'ready', data: cached, offline: true } : { status: 'error' }
        );
      }
    }

    setLibrary({ status: 'loading' });
    setCatalog({ status: 'loading' });
    setMutationError(false);
    void Promise.all([loadLibrary(), loadCatalog()]);

    return () => {
      active = false;
    };
  }, [ownerUserId, reloadToken]);

  async function refreshLocalLibrary(): Promise<void> {
    const [programs, pinned] = await Promise.all([
      listProgramSummaries(ownerUserId),
      readTrackerProgramId(ownerUserId),
    ]);
    setLibrary({ status: 'ready', data: programs, offline: false });
    setPinnedProgramId(pinned);
  }

  async function handleManage(
    program: ProgramSummary,
    mutation: ProgramManagementMutation
  ): Promise<void> {
    if (operationInProgressRef.current) return;
    operationInProgressRef.current = true;
    setBusyProgramId(program.id);
    setMutationError(false);
    try {
      await manageProgram({
        ownerUserId,
        programInstanceId: program.id,
        mutation,
      });
      await refreshLocalLibrary();
    } catch {
      setMutationError(true);
    } finally {
      operationInProgressRef.current = false;
      setBusyProgramId(null);
    }
  }

  async function handlePin(program: ProgramSummary): Promise<boolean> {
    if (operationInProgressRef.current) return false;
    operationInProgressRef.current = true;
    setBusyProgramId(program.id);
    setMutationError(false);
    try {
      await writeTrackerProgramId(ownerUserId, program.id);
      setPinnedProgramId(program.id);
      return true;
    } catch {
      setMutationError(true);
      return false;
    } finally {
      operationInProgressRef.current = false;
      setBusyProgramId(null);
    }
  }

  async function handleOpen(program: ProgramSummary): Promise<void> {
    const pinned = await handlePin(program);
    if (pinned) {
      onOpenProgram(program.id);
    }
  }

  async function performDelete(program: ProgramSummary): Promise<void> {
    if (operationInProgressRef.current) return;
    operationInProgressRef.current = true;
    setBusyProgramId(program.id);
    setMutationError(false);
    try {
      await deleteProgram({
        ownerUserId,
        programInstanceId: program.id,
      });
      await refreshLocalLibrary();
    } catch {
      setMutationError(true);
    } finally {
      operationInProgressRef.current = false;
      setBusyProgramId(null);
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

        {mutationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('programs.errors.mutation')}
          </Text>
        ) : null}

        {library.status === 'loading' ? <ActivityIndicator color={colors.textPrimary} /> : null}
        {library.status === 'error' ? (
          <View style={styles.stateBlock}>
            <Text style={styles.error}>{t('programs.errors.sync')}</Text>
            <ActionButton
              label={t('common.retry')}
              onPress={() => setReloadToken((current) => current + 1)}
            />
          </View>
        ) : null}
        {library.status === 'ready' ? (
          <>
            {library.offline ? (
              <View accessibilityRole="alert" style={styles.offlineBanner}>
                <Text style={styles.offlineText}>{t('programs.offline_library')}</Text>
              </View>
            ) : null}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {t('programs.pinned.title')}
              </Text>
              {pinnedProgram ? (
                <Pressable
                  accessibilityRole="button"
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
          {catalog.status === 'loading' ? <ActivityIndicator color={colors.textPrimary} /> : null}
          {catalog.status === 'error' ? (
            <View style={styles.stateBlock}>
              <Text style={styles.error}>{t('programs.errors.catalog')}</Text>
              <ActionButton
                label={t('common.retry')}
                onPress={() => setReloadToken((current) => current + 1)}
              />
            </View>
          ) : null}
          {catalog.status === 'ready' ? (
            <>
              {catalog.offline ? (
                <View accessibilityRole="alert" style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>{t('programs.offline_catalog')}</Text>
                </View>
              ) : null}
              {catalog.data.map((entry) => (
                <Pressable
                  accessibilityLabel={t('programs.catalog_open_accessibility', {
                    name: entry.name,
                  })}
                  accessibilityRole="button"
                  key={entry.id}
                  onPress={() => onOpenPreset(entry.id)}
                  style={styles.catalogCard}
                >
                  <Text style={styles.cardTitle}>{entry.name}</Text>
                  <Text style={styles.cardMeta}>{entry.description}</Text>
                  <Text style={styles.catalogMeta}>
                    {t('programs.catalog_meta', {
                      level: entry.level,
                      total: entry.totalWorkouts,
                      perWeek: entry.workoutsPerWeek,
                    })}
                  </Text>
                  <Text style={styles.catalogAction}>{t('programs.catalog_open')}</Text>
                </Pressable>
              ))}
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
