import { useLocalSearchParams } from 'expo-router';

import { parseRouteIdentifier } from '../../navigation/routes';
import { DeferredRoute } from '../../ui/deferred-route';

export default function WorkoutSessionRoute() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();

  return (
    <DeferredRoute
      route="workout_session"
      validIdentifier={parseRouteIdentifier(params.sessionId) !== null}
    />
  );
}
