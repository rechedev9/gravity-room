import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CatalogEntry } from '@gzclp/domain';

import { TrackerScreen } from '../tracker/tracker-screen';
import { colors, radii, spacing } from '../../app/design';
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

export function ProgramsScreen() {
  const [programs, setPrograms] = useState<readonly ProgramSummary[]>([]);
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
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
          setError('Unable to sync programs right now.');
        } else {
          setSyncNotice('Showing cached programs. Sync will retry when you refresh.');
        }
      }
    } catch {
      if (signal.active) {
        setPrograms([]);
        setError('Unable to load cached programs.');
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
        setCatalogError('Unable to load the program catalog right now.');
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
      setSelectedProgramId(detail.id);
    } catch {
      setCatalogError('Unable to start that program right now.');
    } finally {
      setCreatingProgramId(null);
    }
  }

  if (selectedProgramId) {
    return (
      <TrackerScreen
        programInstanceId={selectedProgramId}
        onBack={() => setSelectedProgramId(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Programs</Text>
        <Text style={styles.title}>Cached training blocks</Text>
        <Text style={styles.body}>
          Your active blocks stay available offline. Start a preset to cache it on this device.
        </Text>
        {loading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color="#F8FAFC" />
          </View>
        ) : error ? (
          <View style={styles.stateBlock}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {syncNotice ? (
              <View style={styles.syncNoticeBlock}>
                <Text style={styles.syncNotice}>{syncNotice}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRetry}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryLabel}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            <FlatList
              data={programs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.empty}>No cached programs yet.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedProgramId(item.id)}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>Updated {item.updatedAt.slice(0, 10)}</Text>
                </Pressable>
              )}
            />
            <View style={styles.catalogSection}>
              <Text style={styles.sectionTitle}>Start a program</Text>
              {catalogLoading ? (
                <View style={styles.catalogStateBlock}>
                  <ActivityIndicator color={colors.textPrimary} />
                </View>
              ) : catalogError ? (
                <View style={styles.catalogStateBlock}>
                  <Text style={styles.error}>{catalogError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRetry}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryLabel}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.catalogList}>
                  {catalog.map((entry) => {
                    const isCreating = creatingProgramId === entry.id;
                    return (
                      <View key={entry.id} style={styles.catalogCard}>
                        <View style={styles.catalogCopy}>
                          <Text style={styles.cardTitle}>{entry.name}</Text>
                          <Text style={styles.cardMeta}>{entry.description}</Text>
                          <Text style={styles.catalogMeta}>
                            {entry.level} · {entry.totalWorkouts} workouts · {entry.workoutsPerWeek}
                            /week
                          </Text>
                        </View>
                        <Pressable
                          accessibilityLabel={`Start ${entry.name}`}
                          accessibilityRole="button"
                          disabled={creatingProgramId !== null}
                          onPress={() => {
                            void handleCreateProgram(entry);
                          }}
                          style={[
                            styles.startButton,
                            isCreating ? styles.startButtonDisabled : null,
                          ]}
                        >
                          <Text style={styles.startLabel}>
                            {isCreating ? 'Starting...' : 'Start'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    gap: spacing.stack,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '600',
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
  stateBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    gap: 12,
    paddingVertical: 8,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  error: {
    color: colors.textError,
    fontSize: 16,
    textAlign: 'center',
  },
  syncNotice: {
    color: colors.accentWarning,
    fontSize: 14,
    lineHeight: 20,
  },
  syncNoticeBlock: {
    gap: 12,
    alignItems: 'flex-start',
  },
  retryButton: {
    marginTop: 12,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  catalogSection: {
    gap: spacing.stack,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  catalogStateBlock: {
    alignItems: 'center',
    gap: spacing.stack,
    paddingVertical: 20,
  },
  catalogList: {
    gap: spacing.stack,
  },
  catalogCard: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.card,
    gap: spacing.stack,
  },
  catalogCopy: {
    gap: 6,
  },
  catalogMeta: {
    color: colors.accentPrimary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  startButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.accentSuccess,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  startButtonDisabled: {
    opacity: 0.55,
  },
  startLabel: {
    color: '#04130A',
    fontSize: 15,
    fontWeight: '700',
  },
});
