import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '../../shell/design';
import { useProgramSummaries } from '../../lib/programs/program-queries';
import { Button } from '../../ui/button';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import { TrackerScreen } from '../tracker/tracker-screen';
import type { TrackerLoadFailure } from '../tracker/tracker-load-error';

type TrainScreenProps = {
  readonly isFocused?: boolean;
  /** Set when the user opened a specific plan. Null lets Train pick a plan it can open. */
  readonly requestedProgramId: string | null;
  readonly onOpenPrograms: () => void;
};

export function TrainScreen({
  isFocused = true,
  requestedProgramId,
  onOpenPrograms,
}: TrainScreenProps) {
  const { t } = useTranslation();
  const query = useProgramSummaries(requestedProgramId === null);
  const [rejectedIds, setRejectedIds] = useState<readonly string[]>([]);
  const [lastFailure, setLastFailure] = useState<TrackerLoadFailure>('missing_template');
  const automaticIdRef = useRef<string | null>(null);
  const programs = query.data?.programs ?? [];
  const candidate = programs.find((program) => !rejectedIds.includes(program.id))?.id ?? null;
  const activeId = requestedProgramId ?? candidate;
  automaticIdRef.current = requestedProgramId === null ? candidate : null;
  const loading = requestedProgramId === null && query.isPending;
  const resolvedEmpty = requestedProgramId === null && !loading && programs.length === 0;

  function rejectAutomatic(failure: TrackerLoadFailure): void {
    if (requestedProgramId !== null || failure === 'unavailable') return;
    const id = automaticIdRef.current;
    if (!id) return;
    setLastFailure(failure);
    setRejectedIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  if (activeId) {
    return (
      <TrackerScreen
        isFocused={isFocused}
        key={activeId}
        programInstanceId={activeId}
        onBack={onOpenPrograms}
        onTemplateUnavailable={rejectAutomatic}
      />
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen>
        <Text accessibilityRole="alert" style={styles.body}>
          {t(query.error.message === 'load' ? 'programs.errors.load' : 'programs.errors.sync')}
        </Text>
        <Button
          isLoading={query.isFetching}
          onPress={() => {
            void query.refetch();
          }}
        >
          {t('common.retry')}
        </Button>
      </Screen>
    );
  }

  if (resolvedEmpty) {
    return (
      <Screen>
        <Kicker>{t('nav.train')}</Kicker>
        <Text style={styles.title}>{t('train.empty.title')}</Text>
        <Text style={styles.body}>{t('train.empty.body')}</Text>
        <Button variant="primary" onPress={onOpenPrograms}>
          {t('train.empty.open_programs')}
        </Button>
      </Screen>
    );
  }

  const blockedTitle =
    lastFailure === 'template_unreadable'
      ? t('tracker.template_unreadable_title')
      : t('tracker.missing_template_title');
  const blockedBody =
    lastFailure === 'template_unreadable'
      ? t('tracker.template_unreadable_body')
      : t('tracker.missing_template_body');

  return (
    <Screen>
      <Text style={styles.title}>{blockedTitle}</Text>
      <Text style={styles.body}>{blockedBody}</Text>
      <Button variant="primary" onPress={onOpenPrograms}>
        {t('train.empty.open_programs')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.displaySm,
  },
  body: {
    ...type.body,
  },
});
