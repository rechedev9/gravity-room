import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { ExerciseEntry } from '@gzclp/domain';
import { useExercisePages, useMuscleGroups } from '../../lib/exercises/exercise-queries';
import { ExerciseRequestError, type ExerciseFailure } from '../../lib/exercises/exercise-service';
import { type } from '../../shell/design';
import { colors, spacing } from '@gzclp/design-tokens';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { EdgeFade } from '../../ui/edge-fade';
import { Screen } from '../../ui/screen';
import { ScreenHeader } from '../../ui/screen-header';
import { SearchField } from '../../ui/search-field';
import { StateMessage } from '../../ui/state-message';
import { ExerciseDetailSheet } from './exercise-detail-sheet';
import { attributeLabel } from './exercise-labels';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_SEARCH_LENGTH = 100;

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function failureOf(error: Error | null): ExerciseFailure {
  return error instanceof ExerciseRequestError ? error.failure : 'network';
}

export function ExercisesScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [muscleGroupId, setMuscleGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExerciseEntry | null>(null);
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const query = useExercisePages({ search: debouncedSearch, muscleGroupId });
  const groups = useMuscleGroups();
  const muscleGroups = groups.data ?? [];
  const pages = query.data ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const hasFilters = search.trim() !== '' || muscleGroupId !== null;
  const settling = search.trim() !== debouncedSearch.trim() || query.isPlaceholderData;
  const failure = query.isError && items.length === 0 ? failureOf(query.error) : null;
  const muscleName = (id: string) =>
    attributeLabel(t, 'muscle', id, muscleGroups.find((group) => group.id === id)?.name);

  function resetFilters(): void {
    setSearch('');
    setMuscleGroupId(null);
  }

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        eyebrow={t('exercises.eyebrow')}
        title={t('exercises.title')}
        trailing={
          total > 0 ? (
            <Text accessibilityLiveRegion="polite" style={styles.count}>
              {t('exercises.count', { count: total })}
            </Text>
          ) : null
        }
      />
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder={t('exercises.search')}
        clearLabel={t('exercises.clear')}
        maxLength={MAX_SEARCH_LENGTH}
      />
      {muscleGroups.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            accessibilityLabel={t('exercises.filter_label')}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}
          >
            <Chip selected={muscleGroupId === null} onPress={() => setMuscleGroupId(null)}>
              {t('exercises.all')}
            </Chip>
            {muscleGroups.map((group) => (
              <Chip
                key={group.id}
                selected={muscleGroupId === group.id}
                onPress={() => setMuscleGroupId(muscleGroupId === group.id ? null : group.id)}
              >
                {muscleName(group.id)}
              </Chip>
            ))}
          </ScrollView>
          <EdgeFade edge="right" size={28} />
        </View>
      ) : null}
    </View>
  );

  let body = null;
  if (query.isPending) {
    body = <SkeletonRows label={t('exercises.loading')} />;
  } else if (failure) {
    const kind = failure === 'network' ? 'network' : failure;
    body = (
      <StateMessage
        icon={failure === 'network' ? 'cloud-offline-outline' : 'alert-circle-outline'}
        title={t(`exercises.${kind}_title`)}
        body={t(`exercises.${kind}_body`)}
        actionLabel={t('common.retry')}
        actionLoading={query.isFetching}
        onAction={() => {
          void query.refetch();
        }}
      />
    );
  } else if (items.length === 0) {
    body = (
      <StateMessage
        icon="search-outline"
        title={t('exercises.empty_title')}
        body={t('exercises.empty_body')}
        {...(hasFilters ? { actionLabel: t('exercises.reset'), onAction: resetFilters } : {})}
      />
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.top}>{header}</View>
      {body ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.stateScroll}>
          {body}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, settling ? styles.settling : null]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage && !settling}
              onRefresh={() => {
                void query.refetch();
              }}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.card}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) {
              void query.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <ExerciseRow
              name={item.name}
              meta={[
                muscleName(item.muscleGroupId),
                item.equipment ? attributeLabel(t, 'equipment', item.equipment) : null,
              ]
                .filter((part): part is string => part !== null)
                .join(' · ')}
              label={t('exercises.open', { name: item.name })}
              onPress={() => setSelected(item)}
            />
          )}
          ListFooterComponent={
            query.isFetchNextPageError ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('exercises.more_error')}</Text>
                <Button
                  onPress={() => {
                    void query.fetchNextPage();
                  }}
                >
                  {t('common.retry')}
                </Button>
              </View>
            ) : query.isFetchingNextPage ? (
              <View accessibilityLabel={t('exercises.loading_more')} style={styles.footer}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
        />
      )}
      <ExerciseDetailSheet
        exercise={selected}
        muscleGroups={muscleGroups}
        onClose={() => setSelected(null)}
      />
    </Screen>
  );
}

function ExerciseRow(props: {
  readonly name: string;
  readonly meta: string;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {props.name}
        </Text>
        {props.meta ? (
          <Text numberOfLines={1} style={styles.rowMeta}>
            {props.meta}
          </Text>
        ) : null}
      </View>
      <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function SkeletonRows({ label }: { readonly label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.skeletonList}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.rowCopy}>
            <View style={[styles.bar, { width: `${68 - (index % 3) * 14}%` }]} />
            <View style={[styles.bar, styles.barSmall]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screenX, paddingTop: 20, paddingBottom: 8 },
  header: { gap: spacing.stack },
  count: { ...type.meta },
  chips: { gap: 6, paddingRight: 28 },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.tabClearance, gap: 8 },
  skeletonList: { gap: 8 },
  settling: { opacity: 0.55 },
  stateScroll: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.tabClearance },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.surface2 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { ...type.title, fontSize: 16, lineHeight: 21 },
  rowMeta: { ...type.body, fontSize: 13, lineHeight: 18 },
  footer: { paddingVertical: 20, gap: 12, alignItems: 'center' },
  footerText: { ...type.body, fontSize: 14 },
  bar: { height: 14, borderRadius: 7, backgroundColor: colors.surface2 },
  barSmall: { width: '40%', height: 10 },
});
