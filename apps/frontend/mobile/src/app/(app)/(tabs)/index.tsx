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
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const requestedProgramId = typeof id === 'string' && id.length > 0 ? id : null;
  return (
    <TrainScreen
      isFocused={isFocused}
      requestedProgramId={requestedProgramId}
      onOpenPrograms={() => router.navigate('/mesos')}
    />
  );
}
