import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { TrainScreen } from '../../../features/train/train-screen';

export default function WorkoutRoute() {
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  return (
    <TrainScreen
      isFocused={isFocused}
      programInstanceId={id ?? instanceId}
      onResolvedProgram={setInstanceId}
      onOpenPrograms={() => router.navigate('/mesos')}
    />
  );
}
