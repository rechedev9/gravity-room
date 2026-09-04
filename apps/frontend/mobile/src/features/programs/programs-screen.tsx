import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@gzclp/domain';

import { colors, type } from '../../app/design';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import {
  listProgramSummaries,
  type ProgramSummary,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
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
  readonly onOpenProgram?: (programInstanceId: string) => void;
};

export function ProgramsScreen({ onOpenProgram }: ProgramsScreenProps = {}) {
  const { t } = useTranslation();
  const [programs, setPrograms] = useState<readonly ProgramSummary[]>([]);
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [creatingProgramId, setCreatingProgramId] = useState<string | null>(null);

  async function loadPrograms(signal: { active: boolean }): Promise<void> {
    try {
      const cachedPrograms = await listProgramSummaries();
      if (!signal.active) {
        return;
      }

      setPrograms(cachedPrograms);
      setError(null);
      setSyncNotice(null);

      if (cachedPrograms.length > 0) {
        setLoading(false);
      }

      try {
        const remotePrograms = await fetchProgramSummaries();
        await upsertProgramSummaries(remotePrograms);
        const refreshedPrograms = await listProgramSummaries();

        if (signal.active) {
          setPrograms(refreshedPrograms);
          setSyncNotice(null);
          setError(null);
        }
      } catch {
        if (!signal.active) {
          return;
        }

        if (cachedPrograms.length === 0) {
          setError(t('programs.errors.sync'));
        } else {
          setSyncNotice(t('programs.sync_notice'));
        }
      }
    } catch {
      if (signal.active) {
        setPrograms([]);
        setError(t('programs.errors.load'));
        setSyncNotice(null);
      }
    } finally {
      if (signal.active) {
        setLoading(false);
      }
    }
  }

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

    setLoading(true);
    setCatalogLoading(true);
    void loadPrograms(signal);
    void loadCatalog(signal);

    return () => {
      active = false;
    };
  }, [reloadToken]);

  function handleRetry() {
    setReloadToken((value) => value + 1);
  }

  async function handleCreateProgram(entry: CatalogEntry): Promise<void> {
    if (creatingProgramId) {
      return;
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
        title: detail.name,
        updatedAt: detail.updatedAt,
      };
      const nextPrograms = mergeProgramSummary(programs, nextSummary);

      await upsertProgramDefinition(definition);
      await upsertProgramDetail(detail);
      await upsertProgramSummaries(nextPrograms);

      setPrograms(nextPrograms);
      setSyncNotice(null);
      setError(null);
      onOpenProgram?.(detail.id);
    } catch {
      setCatalogError(t('programs.errors.start'));
    } finally {
      setCreatingProgramId(null);
    }
  }

  return (
    <Screen>
      <Kicker>{t('programs.eyebrow')}</Kicker>
      <Text style={styles.title}>{t('programs.title')}</Text>
      <Text style={styles.body}>{t('programs.body')}</Text>
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
              <View style={styles.catalogList}>
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
              </View>
            )}
          </View>
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
    ...type.meta,
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
    gap: 10,
  },
  catalogCopy: {
    gap: 6,
  },
  catalogMeta: {
    ...type.kicker,
    color: colors.accentDeep,
  },
});
