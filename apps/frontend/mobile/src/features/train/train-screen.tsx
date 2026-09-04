import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '../../app/design';
import {
  listProgramSummaries,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import { fetchProgramSummaries } from '../../lib/programs/program-service';
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
  const [loading, setLoading] = useState(programInstanceId === null);
  const [resolvedEmpty, setResolvedEmpty] = useState(false);

  useEffect(() => {
    if (programInstanceId !== null) {
      setLoading(false);
      setResolvedEmpty(false);
      return;
    }

    let active = true;
    setLoading(true);
    setResolvedEmpty(false);

    void (async () => {
      try {
        const cachedPrograms = await listProgramSummaries();
        if (!active) {
          return;
        }

        if (cachedPrograms[0]) {
          onResolvedProgram(cachedPrograms[0].id);
          setLoading(false);
        }

        try {
          const remotePrograms = await fetchProgramSummaries();
          await upsertProgramSummaries(remotePrograms);
          const refreshedPrograms = await listProgramSummaries();
          if (!active) {
            return;
          }

          if (refreshedPrograms[0]) {
            onResolvedProgram(refreshedPrograms[0].id);
            setResolvedEmpty(false);
            setLoading(false);
            return;
          }
        } catch {
          if (!active) {
            return;
          }

          if (cachedPrograms[0]) {
            setLoading(false);
            return;
          }
        }

        setResolvedEmpty(true);
        setLoading(false);
      } catch {
        if (active) {
          setResolvedEmpty(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [onResolvedProgram, programInstanceId]);

  if (programInstanceId) {
    return <TrackerScreen programInstanceId={programInstanceId} onBack={onOpenPrograms} />;
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
