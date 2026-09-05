import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '../../shell/design';
import { useProgramSummaries } from '../../lib/programs/program-queries';
import { Button } from '../../ui/button';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import { TrackerScreen } from '../tracker/tracker-screen';

type TrainScreenProps = {
  readonly programInstanceId: string | null;
  readonly onResolvedProgram: (programInstanceId: string) => void;
  readonly onOpenPrograms: () => void;
};

export function TrainScreen({
  programInstanceId,
  onResolvedProgram,
  onOpenPrograms,
}: TrainScreenProps) {
  const { t } = useTranslation();
  const query = useProgramSummaries(programInstanceId === null);
  const firstProgramId = query.data?.programs[0]?.id;
  useEffect(() => {
    if (programInstanceId === null && firstProgramId !== undefined)
      onResolvedProgram(firstProgramId);
  }, [firstProgramId, onResolvedProgram, programInstanceId]);
  const loading = query.isPending;
  const resolvedEmpty = !loading && firstProgramId === undefined;

  if (programInstanceId) {
    return (
      <TrackerScreen
        key={programInstanceId}
        programInstanceId={programInstanceId}
        onBack={onOpenPrograms}
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

  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
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
