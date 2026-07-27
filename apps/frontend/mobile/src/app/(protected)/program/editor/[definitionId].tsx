import { useLocalSearchParams } from 'expo-router';

import { DeferredRouteAdapter } from '../../../../navigation/deferred-route-adapter';
import { parseRouteIdentifier } from '../../../../navigation/routes';

export default function ProgramEditorRoute() {
  const params = useLocalSearchParams<{ definitionId?: string | string[] }>();

  return (
    <DeferredRouteAdapter
      route="program_editor"
      validIdentifier={parseRouteIdentifier(params.definitionId) !== null}
    />
  );
}
