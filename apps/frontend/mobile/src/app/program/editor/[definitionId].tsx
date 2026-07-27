import { useLocalSearchParams } from 'expo-router';

import { parseRouteIdentifier } from '../../../navigation/routes';
import { DeferredRoute } from '../../../ui/deferred-route';

export default function ProgramEditorRoute() {
  const params = useLocalSearchParams<{ definitionId?: string | string[] }>();

  return (
    <DeferredRoute
      route="program_editor"
      validIdentifier={parseRouteIdentifier(params.definitionId) !== null}
    />
  );
}
