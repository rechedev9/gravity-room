import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listProgramSummaries,
  type ProgramSummary,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';

const SEEDED_PROGRAMS: readonly ProgramSummary[] = [
  {
    id: 'starter-strength',
    title: 'Starter Strength',
    updatedAt: '2026-04-20T08:00:00.000Z',
  },
  {
    id: 'hypertrophy-foundation',
    title: 'Hypertrophy Foundation',
    updatedAt: '2026-04-18T12:30:00.000Z',
  },
];

export function ProgramsScreen() {
  const [programs, setPrograms] = useState<readonly ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await upsertProgramSummaries(SEEDED_PROGRAMS);
        const cachedPrograms = await listProgramSummaries();
        if (active) {
          setPrograms(cachedPrograms);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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
        ) : (
          <FlatList
            data={programs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No cached programs yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>Updated {item.updatedAt.slice(0, 10)}</Text>
              </View>
            )}
          />
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
