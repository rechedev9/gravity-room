import { useRouter } from 'expo-router';

import { DeferredRoute, type DeferredRouteName } from '../ui/deferred-route';
import { returnFromSecondaryRoute } from './routes';

interface DeferredRouteAdapterProps {
  readonly route: DeferredRouteName;
  readonly validIdentifier?: boolean;
}

export function DeferredRouteAdapter({ route, validIdentifier }: DeferredRouteAdapterProps) {
  const router = useRouter();

  return (
    <DeferredRoute
      onExit={() => returnFromSecondaryRoute(router)}
      route={route}
      {...(validIdentifier === undefined ? {} : { validIdentifier })}
    />
  );
}
