import { useLocalSearchParams } from 'expo-router';

import { DeferredRouteAdapter } from '../../../navigation/deferred-route-adapter';
import { parseRouteIdentifier } from '../../../navigation/routes';

export default function ExerciseDetailRoute() {
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();

  return (
    <DeferredRouteAdapter
      route="exercise_detail"
      validIdentifier={parseRouteIdentifier(params.exerciseId) !== null}
    />
  );
}
