import { useSyncStatus } from '../../shell/sync-status-provider';
import { MyPlans } from './my-plans';
import { CatalogBrowser } from './catalog-browser';
import { useQueryClient } from '@tanstack/react-query';
import { PROGRAM_SUMMARIES_KEY, useProgramSummaries } from '../../lib/programs/program-queries';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@gzclp/domain';

import { colors, type } from '../../shell/design';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import {
  type ProgramSummary,
  listProgramSummaries,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
} from '../../lib/programs/program-service';
import {
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';

function mergeProgramSummary(
  programs: readonly ProgramSummary[],
  nextProgram: ProgramSummary
): ProgramSummary[] {
  return [nextProgram, ...programs.filter((program) => program.id !== nextProgram.id)];
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
    void summaryQuery.refetch();
    setReloadToken((value) => value + 1);
  }

  async function handleCreateProgram(entry: CatalogEntry): Promise<boolean> {
    if (creatingProgramId) {
      return false;
    }

    setCreatingProgramId(entry.id);
    setCatalogError(null);

    try {
      const definition = await fetchCatalogDefinition(entry.id);
      const detail = await createProgramInstance({
        programId: definition.id,
        name: definition.name,
        config: buildDefaultProgramConfig(definition),
      });
      const nextSummary = {
        id: detail.id,
        programId: detail.programId,
        title: detail.name,
        updatedAt: detail.updatedAt,
      };
      await queryClient.cancelQueries({ queryKey: PROGRAM_SUMMARIES_KEY });
      // Catalog does not load the summaries query. Merge the authoritative cache.
      const nextPrograms = mergeProgramSummary(await listProgramSummaries(), nextSummary);
      await upsertProgramDefinition(definition);
      await upsertProgramDetail(detail);
      await upsertProgramSummaries(nextPrograms);

      queryClient.setQueryData(PROGRAM_SUMMARIES_KEY, { programs: nextPrograms, cached: false });
      onOpenProgram?.(detail.id);
      return true;
    } catch {
      setCatalogError(t('programs.errors.start'));
      return false;
    } finally {
      setCreatingProgramId(null);
    }
  }

  if (mode === 'catalog')
    return (
      <CatalogBrowser
        entries={catalog}
        loading={catalogLoading}
        error={catalogError}
        creatingId={creatingProgramId}
        onRetry={handleRetry}
        onStart={handleCreateProgram}
      />
    );

  if (mode === 'instances')
    return (
      <MyPlans
        programs={programs}
        loading={loading}
        error={error}
        syncNotice={syncNotice}
        onRetry={handleRetry}
        onOpen={onOpenProgram}
        onExplore={onExplorePrograms}
      />
    );

  return (
    <Screen>
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
