import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { TrainScreen } from '../../../features/train/train-screen';

export default function WorkoutRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  return (
    <TrainScreen
      programInstanceId={id ?? instanceId}
      onResolvedProgram={setInstanceId}
      onOpenPrograms={() => router.navigate('/mesos')}
    />
  );
}
