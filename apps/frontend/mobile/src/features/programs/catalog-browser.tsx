import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { CatalogEntry } from '@gzclp/domain';
import { colors, type } from '../../shell/design';
import { Screen } from '../../ui/screen';
import { Chip } from '../../ui/chip';
import { Sheet } from '../../ui/sheet';
import { Button } from '../../ui/button';
import { ProgramArtwork } from '../../ui/program-artwork';

type Props = {
  readonly entries: readonly CatalogEntry[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly creatingId: string | null;
  readonly onRetry: () => void;
  readonly onStart: (entry: CatalogEntry) => Promise<boolean>;
};

export function CatalogBrowser({ entries, loading, error, creatingId, onRetry, onStart }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const filtered = entries.filter(
    (entry) =>
      (level === 'all' || entry.level === level) &&
      `${entry.name} ${entry.description}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  );
  const featured =
    search.trim() === '' && level === 'all'
      ? entries.find((entry) => entry.id === 'gzclp')
      : undefined;
  const label = (entry: CatalogEntry) => t('discovery.open', { name: entry.name });
  const metadata = (entry: CatalogEntry) =>
    `${t('discovery.frequency', { count: entry.workoutsPerWeek })} · ${t(`discovery.level.${entry.level}`)}`;
  return (
    <Screen padded={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.brand}>GRAVITY ROOM</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('discovery.title')}
        </Text>
        <Text style={styles.subtitle}>{t('discovery.subtitle')}</Text>
        <View style={styles.search}>
          <Ionicons accessible={false} name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            accessibilityLabel={t('discovery.search')}
            placeholder={t('discovery.search')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {search !== '' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discovery.clear')}
              onPress={() => setSearch('')}
              style={styles.clear}
            >
              <Ionicons accessible={false} name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {['all', 'beginner', 'intermediate', 'advanced'].map((value) => (
            <Chip key={value} selected={level === value} onPress={() => setLevel(value)}>
              {t(`discovery.level.${value}`)}
            </Chip>
          ))}
        </ScrollView>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error && selected === null ? (
          <View style={styles.message}>
            <Text style={styles.subtitle}>{error}</Text>
            <Button onPress={onRetry}>{t('common.retry')}</Button>
          </View>
        ) : null}
        {featured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label(featured)}
            onPress={() => setSelected(featured)}
            style={styles.featured}
          >
            <ProgramArtwork programId={featured.id} />
            <View style={styles.featureBody}>
              <Text style={styles.featureLabel}>{t('discovery.featured')}</Text>
              <Text style={styles.featureTitle}>{featured.name}</Text>
              <Text style={styles.featureMeta}>{metadata(featured)}</Text>
              <View style={styles.featureAction}>
                <Text style={styles.featureActionText}>{t('discovery.view')}</Text>
                <Ionicons accessible={false} name="arrow-forward" size={18} color={colors.accent} />
              </View>
            </View>
          </Pressable>
        ) : null}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('discovery.all_programs')}
          </Text>
          <Text style={styles.count}>{filtered.length}</Text>
        </View>
        {!loading && filtered.length === 0 ? (
          <Text style={styles.subtitle}>{t('discovery.empty')}</Text>
        ) : null}
        {filtered.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={label(entry)}
            onPress={() => setSelected(entry)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <ProgramArtwork programId={entry.id} thumbnail />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{entry.name}</Text>
              <Text style={styles.rowMeta}>{metadata(entry)}</Text>
            </View>
            <Ionicons
              accessible={false}
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        ))}
      </ScrollView>
      <Sheet
        visible={selected !== null}
        title={selected?.name ?? ''}
        onClose={() => {
          if (creatingId === null) setSelected(null);
        }}
      >
        {selected ? (
          <>
            <View style={styles.detailArt}>
              <ProgramArtwork programId={selected.id} />
            </View>
            <Text style={styles.featureLabel}>{metadata(selected)}</Text>
            <Text style={styles.description}>{selected.description}</Text>
            <Text style={styles.rowMeta}>
              {t('discovery.sessions', { count: selected.totalWorkouts })}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Button
              variant="primary"
              accessibilityLabel={t('programs.start_accessibility', { name: selected.name })}
              isLoading={creatingId === selected.id}
              disabled={creatingId !== null}
              onPress={() => {
                void onStart(selected).then((created) => {
                  if (created) setSelected(null);
                });
              }}
            >
              {t('programs.start')}
            </Button>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  brand: { ...type.kicker, color: colors.accent, letterSpacing: 3, marginBottom: 6 },
  title: { ...type.display, fontSize: 34, lineHeight: 38, maxWidth: 310 },
  subtitle: { ...type.body, fontSize: 14, lineHeight: 21 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 12,
    paddingLeft: 14,
    marginTop: 6,
  },
  searchInput: {
    ...type.body,
    color: colors.textPrimary,
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
  },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 6 },
  featured: {
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    overflow: 'hidden',
  },
  featureBody: { padding: 18, gap: 8 },
  detailArt: { borderRadius: 14, overflow: 'hidden' },
  featureLabel: { ...type.kicker, color: colors.accent, fontSize: 9 },
  featureTitle: {
    ...type.display,
    fontSize: 30,
    lineHeight: 34,
  },
  featureMeta: { ...type.body, fontSize: 12, color: colors.textSecondary },
  featureAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: colors.card,
  },
  featureActionText: { ...type.button, color: colors.accent },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  sectionTitle: { ...type.title, fontSize: 20 },
  count: { ...type.meta },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.card,
    minHeight: 88,
  },
  pressed: { backgroundColor: colors.surface2 },
  rowCopy: { flex: 1, gap: 5 },
  rowTitle: { ...type.title, fontSize: 16 },
  rowMeta: { ...type.body, fontSize: 12, lineHeight: 18 },
  message: { gap: 10 },
  description: { ...type.body, color: colors.textPrimary },
  error: { ...type.body, color: colors.fail },
});
