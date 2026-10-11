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
import {
  CATALOG_LEVEL_FILTERS,
  filterCatalogEntries,
  hasCatalogFilters,
  pickFeaturedEntry,
  type CatalogLevelFilter,
} from '@gzclp/domain/catalog-filter';
import { type } from '../../shell/design';
import { colors, spacing } from '@gzclp/design-tokens';
import { Screen } from '../../ui/screen';
import { ScreenHeader } from '../../ui/screen-header';
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
  const [level, setLevel] = useState<CatalogLevelFilter>('all');
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const query = { search, level };
  const filtered = filterCatalogEntries({ entries, query });
  const hasFilters = hasCatalogFilters(query);
  const featured = pickFeaturedEntry(entries, query);
  const label = (entry: CatalogEntry) => t('discovery.open', { name: entry.name });
  const metadata = (entry: CatalogEntry) =>
    `${t('discovery.frequency', { count: entry.workoutsPerWeek })} · ${t(`discovery.level.${entry.level}`)}`;
  const resetFilters = () => {
    setSearch('');
    setLevel('all');
  };
  return (
    <Screen padded={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ScreenHeader
          eyebrow="GRAVITY ROOM"
          title={t('discovery.title')}
          subtitle={t('discovery.subtitle')}
        />
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
          {CATALOG_LEVEL_FILTERS.map((value) => (
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
            style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
          >
            <ProgramArtwork
              programId={featured.id}
              title={featured.name}
              category={featured.category}
              level={featured.level}
              workoutsPerWeek={featured.workoutsPerWeek}
            />
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
          {!loading && error === null ? (
            <Text
              accessibilityLabel={t('discovery.results_count', { count: filtered.length })}
              accessibilityLiveRegion="polite"
              style={styles.count}
            >
              {filtered.length}
            </Text>
          ) : null}
        </View>
        {!loading && error === null && filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.subtitle}>{t('discovery.empty')}</Text>
            {hasFilters ? (
              <Button onPress={resetFilters}>{t('discovery.reset_filters')}</Button>
            ) : null}
          </View>
        ) : null}
        {filtered.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={label(entry)}
            onPress={() => setSelected(entry)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <ProgramArtwork
              programId={entry.id}
              title={entry.name}
              category={entry.category}
              level={entry.level}
              workoutsPerWeek={entry.workoutsPerWeek}
              thumbnail
            />
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
              <ProgramArtwork
                programId={selected.id}
                title={selected.name}
                category={selected.category}
                level={selected.level}
                workoutsPerWeek={selected.workoutsPerWeek}
              />
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
  content: { padding: 20, paddingBottom: spacing.tabClearance, gap: 14 },
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
  empty: { gap: 12 },
  description: { ...type.body, color: colors.textPrimary },
  error: { ...type.body, color: colors.fail },
});
