import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listProgramSummaries,
  type ProgramSummary,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import { fetchProgramSummaries } from '../../lib/programs/program-service';

export function ProgramsScreen() {
  const [programs, setPrograms] = useState<readonly ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    const signal = {
      get active() {
        return active;
      },
    };

    setLoading(true);
    void loadPrograms(signal);

    return () => {
      active = false;
    };
  }, [reloadToken]);

  function handleRetry() {
    setReloadToken((value) => value + 1);
  }

  if (selectedProgramId) {
    const { TrackerScreen } =
      require('../tracker/tracker-screen') as typeof import('../tracker/tracker-screen');
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
          The current mobile read path is local-first while sync work lands later.
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
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  eyebrow: {
    color: '#8B9AF4',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    color: '#CBD5E1',
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
    color: '#CBD5E1',
    fontSize: 16,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 16,
    textAlign: 'center',
  },
  syncNotice: {
    color: '#FBBF24',
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
    borderColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#111827',
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 14,
  },
});
