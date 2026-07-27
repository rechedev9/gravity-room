import { useLocalSearchParams } from 'expo-router';

import { parseRouteIdentifier } from '../../navigation/routes';
import { DeferredRoute } from '../../ui/deferred-route';

export default function ExerciseDetailRoute() {
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();

  return (
    <DeferredRoute
      route="exercise_detail"
      validIdentifier={parseRouteIdentifier(params.exerciseId) !== null}
    />
  );
}
