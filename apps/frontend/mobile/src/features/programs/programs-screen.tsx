import { useSyncStatus } from '../../shell/sync-status-provider';
import { MyPlans } from './my-plans';
import { CatalogBrowser } from './catalog-browser';
import { useQueryClient } from '@tanstack/react-query';
import {
  PROGRAM_SUMMARIES_KEY,
  type ProgramSummariesData,
  useProgramSummaries,
} from '../../lib/programs/program-queries';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry, ProgramDefinition } from '@gzclp/domain';

import { colors, type } from '../../shell/design';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import {
  type ProgramSummary,
  listProgramSummaries,
  removeProgramSummary,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import {
  createProgramInstance,
  deleteProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  findPlansFromProgram,
} from '../../lib/programs/program-service';
import {
  purgeProgramLocalData,
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import { StartingWeightsSheet } from './starting-weights-sheet';

function mergeProgramSummary(
  programs: readonly ProgramSummary[],
  nextProgram: ProgramSummary
): ProgramSummary[] {
  return [nextProgram, ...programs.filter((program) => program.id !== nextProgram.id)];
}

/** Native confirm dialog as a promise; dismissing counts as cancel. */
function confirmDialog(input: {
  readonly title: string;
  readonly message: string;
  readonly cancel: string;
  readonly confirm: string;
  readonly destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      input.title,
      input.message,
      [
        { text: input.cancel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: input.confirm,
          ...(input.destructive ? { style: 'destructive' as const } : {}),
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

type ProgramsScreenProps = {
  readonly onExplorePrograms?: () => void;
  readonly mode?: 'all' | 'instances' | 'catalog';
  readonly onOpenProgram?: (programInstanceId: string) => void;
};

export function ProgramsScreen({
  onOpenProgram,
  onExplorePrograms,
  mode = 'all',
}: ProgramsScreenProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const summaryQuery = useProgramSummaries(mode !== 'catalog');
  const programs = summaryQuery.data?.programs ?? [];
  const loading = mode !== 'catalog' && summaryQuery.isPending;
  const error = summaryQuery.error
    ? t(summaryQuery.error.message === 'load' ? 'programs.errors.load' : 'programs.errors.sync')
    : null;
  const syncStatus = useSyncStatus();
  const syncNotice =
    summaryQuery.data?.cached && !syncStatus?.visible ? t('programs.sync_notice') : null;
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [creatingProgramId, setCreatingProgramId] = useState<string | null>(null);
  const [pendingDefinition, setPendingDefinition] = useState<ProgramDefinition | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInFlightRef = useRef(false);

  async function loadCatalog(signal: { active: boolean }): Promise<void> {
    try {
      const catalogEntries = await fetchCatalogEntries();
      if (!signal.active) {
        return;
      }

      setCatalog(catalogEntries);
      setCatalogError(null);
    } catch {
      if (signal.active) {
        setCatalog([]);
        setCatalogError(t('programs.errors.catalog'));
      }
    } finally {
      if (signal.active) {
        setCatalogLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    const signal = {
      get active() {
        return active;
      },
    };

    setCatalogLoading(true);
    if (mode !== 'instances') void loadCatalog(signal);
    else setCatalogLoading(false);

    return () => {
      active = false;
    };
  }, [reloadToken, mode]);

  function handleRetry() {
    setDeleteError(null);
    void summaryQuery.refetch();
    setReloadToken((value) => value + 1);
  }

  /** Start tap: warn about duplicates, then open the starting-weights sheet. */
  async function handleCreateProgram(entry: CatalogEntry): Promise<boolean> {
    if (creatingProgramId) {
      return false;
    }

    setCreatingProgramId(entry.id);
    setCatalogError(null);

    try {
      // Catalog does not load the summaries query; the local cache is authoritative.
      const existing = findPlansFromProgram(await listProgramSummaries().catch(() => []), entry.id);
      if (existing.length > 0) {
        const proceed = await confirmDialog({
          title: t('programs.duplicate.title', { name: entry.name }),
          message: t('programs.duplicate.body'),
          cancel: t('common.cancel'),
          confirm: t('programs.duplicate.confirm'),
        });
        if (!proceed) return false;
      }
      const definition = await fetchCatalogDefinition(entry.id);
      setStartError(null);
      setPendingDefinition(definition);
      return true;
    } catch {
      setCatalogError(t('programs.errors.start'));
      return false;
    } finally {
      setCreatingProgramId(null);
    }
  }

  /** Sheet confirm: create the plan with the lifter's weights and open it. */
  async function handleConfirmStart(config: Record<string, number | string>): Promise<void> {
    const definition = pendingDefinition;
    if (!definition || creatingProgramId) return;

    setCreatingProgramId(definition.id);
    setStartError(null);

    try {
      const detail = await createProgramInstance({
        programId: definition.id,
        name: definition.name,
        config,
      });
      const nextSummary = {
        id: detail.id,
        programId: detail.programId,
        title: detail.name,
        updatedAt: detail.updatedAt,
      };
      await queryClient.cancelQueries({ queryKey: PROGRAM_SUMMARIES_KEY });
      const nextPrograms = mergeProgramSummary(await listProgramSummaries(), nextSummary);
      await upsertProgramDefinition(definition);
      await upsertProgramDetail(detail);
      await upsertProgramSummaries(nextPrograms);

      queryClient.setQueryData(PROGRAM_SUMMARIES_KEY, { programs: nextPrograms, cached: false });
      setPendingDefinition(null);
      onOpenProgram?.(detail.id);
    } catch {
      setStartError(t('programs.errors.start'));
    } finally {
      setCreatingProgramId(null);
    }
  }

  /** Server delete first; the local copies go only once the server agreed. */
  async function handleDeleteProgram(program: ProgramSummary): Promise<void> {
    const confirmed = await confirmDialog({
      title: t('plans.delete_title'),
      message: t('plans.delete_body', { name: program.title }),
      cancel: t('common.cancel'),
      confirm: t('plans.delete_confirm'),
      destructive: true,
    });
    if (!confirmed || deleteInFlightRef.current) return;

    // One delete at a time: the local purge runs exclusive SQLite transactions
    // on the shared connection, and overlapping ones fail after the server
    // has already deleted the plan.
    deleteInFlightRef.current = true;
    setDeleteError(null);
    try {
      await deleteProgramInstance(program.id);
      await queryClient.cancelQueries({ queryKey: PROGRAM_SUMMARIES_KEY });
      // Sequential on purpose: both run an exclusive transaction on the shared
      // SQLite connection, and overlapping exclusive transactions fail.
      await removeProgramSummary(program.id);
      await purgeProgramLocalData(program.id);
      queryClient.setQueryData<ProgramSummariesData | undefined>(PROGRAM_SUMMARIES_KEY, (prev) =>
        prev ? { ...prev, programs: prev.programs.filter((item) => item.id !== program.id) } : prev
      );
    } catch {
      setDeleteError(t('programs.errors.delete'));
    } finally {
      deleteInFlightRef.current = false;
    }
  }

  const startingWeightsSheet = (
    <StartingWeightsSheet
      definition={pendingDefinition}
      busy={creatingProgramId !== null}
      error={startError}
      onClose={() => setPendingDefinition(null)}
      onConfirm={(config) => {
        void handleConfirmStart(config);
      }}
    />
  );

  if (mode === 'catalog')
    return (
      <>
        <CatalogBrowser
          entries={catalog}
          loading={catalogLoading}
          error={catalogError}
          creatingId={creatingProgramId}
          onRetry={handleRetry}
          onStart={handleCreateProgram}
        />
        {startingWeightsSheet}
      </>
    );

  if (mode === 'instances')
    return (
      <MyPlans
        programs={programs}
        loading={loading}
        error={error}
        syncNotice={deleteError ?? syncNotice}
        onRetry={handleRetry}
        onOpen={onOpenProgram}
        onExplore={onExplorePrograms}
        onDelete={(program) => {
          void handleDeleteProgram(program);
        }}
      />
    );

  return (
    <Screen>
      {startingWeightsSheet}
      <Kicker>{t('programs.eyebrow')}</Kicker>
      <Text accessibilityRole="header" style={styles.title}>
        {t('programs.title')}
      </Text>
      <Text style={styles.body}>{t('programs.mesos_intro')}</Text>
      {loading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.stateBlock}>
          <Text style={styles.error}>{error}</Text>
          <Button onPress={handleRetry}>{t('common.retry')}</Button>
        </View>
      ) : (
        <>
          {syncNotice ? (
            <View style={styles.syncNoticeBlock}>
              <Text style={styles.syncNotice}>{syncNotice}</Text>
              <Button onPress={handleRetry}>{t('common.retry')}</Button>
            </View>
          ) : null}
          {
            <FlatList
              data={programs}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Card>
                  <Text style={styles.firstRunTitle}>{t('programs.first_run.title')}</Text>
                  <Text style={styles.firstRunBody}>{t('programs.first_run.body')}</Text>
                </Card>
              }
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" onPress={() => onOpenProgram?.(item.id)}>
                  <Card>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>
                      {t('programs.card_updated', { date: item.updatedAt.slice(0, 10) })}
                    </Text>
                  </Card>
                </Pressable>
              )}
            />
          }
          {
            <View style={styles.catalogSection}>
              <Kicker>{t('programs.catalog_title')}</Kicker>
              {catalogLoading ? (
                <View style={styles.catalogStateBlock}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : catalogError ? (
                <View style={styles.catalogStateBlock}>
                  <Text style={styles.error}>{catalogError}</Text>
                  <Button onPress={handleRetry}>{t('common.retry')}</Button>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.catalogList}
                >
                  {catalog.map((entry) => {
                    const isCreating = creatingProgramId === entry.id;
                    return (
                      <Card key={entry.id}>
                        <View style={styles.catalogCopy}>
                          <Text style={styles.cardTitle}>{entry.name}</Text>
                          <Text style={styles.cardMeta}>{entry.description}</Text>
                          <Text style={styles.catalogMeta}>
                            {t('programs.catalog_meta', {
                              level: entry.level,
                              total: entry.totalWorkouts,
                              perWeek: entry.workoutsPerWeek,
                            })}
                          </Text>
                        </View>
                        <Button
                          variant="primary"
                          accessibilityLabel={t('programs.start_accessibility', {
                            name: entry.name,
                          })}
                          disabled={creatingProgramId !== null}
                          isLoading={isCreating}
                          onPress={() => {
                            void handleCreateProgram(entry);
                          }}
                        >
                          {isCreating ? t('programs.starting') : t('programs.start')}
                        </Button>
                      </Card>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          }
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.displaySm,
  },
  body: {
    ...type.body,
  },
  stateBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingVertical: 8,
  },
  firstRunTitle: {
    ...type.title,
  },
  firstRunBody: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.textError,
    fontSize: 16,
    textAlign: 'center',
  },
  syncNotice: {
    color: colors.warn,
    fontSize: 14,
    lineHeight: 20,
  },
  syncNoticeBlock: {
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  cardMeta: {
    ...type.body,
    fontSize: 13,
    lineHeight: 19,
  },
  catalogSection: {
    gap: 12,
    paddingBottom: 24,
  },
  catalogStateBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  catalogList: {
    gap: 12,
    paddingBottom: 24,
  },
  catalogCopy: {
    gap: 6,
  },
  catalogMeta: {
    ...type.kicker,
    color: colors.textSecondary,
  },
});
