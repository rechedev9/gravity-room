import { useLocalSearchParams } from 'expo-router';

import { DeferredRouteAdapter } from '../../../navigation/deferred-route-adapter';
import { parseRouteIdentifier } from '../../../navigation/routes';

export default function WorkoutSessionRoute() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();

  return (
    <DeferredRouteAdapter
      route="workout_session"
      validIdentifier={parseRouteIdentifier(params.sessionId) !== null}
    />
  );
}
