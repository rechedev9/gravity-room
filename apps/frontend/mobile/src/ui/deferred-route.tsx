import { useTranslation } from 'react-i18next';

import { MessageState } from './message-state';

interface DeferredRouteProps {
  readonly route:
    | 'program_new'
    | 'program_editor'
    | 'workout_history'
    | 'workout_session'
    | 'exercise_index'
    | 'exercise_detail'
    | 'sync';
  readonly validIdentifier?: boolean;
}

export function DeferredRoute({ route, validIdentifier = true }: DeferredRouteProps) {
  const { t } = useTranslation();

  if (!validIdentifier) {
    return (
      <MessageState
        body={t('deferred_routes.invalid_body')}
        title={t('deferred_routes.invalid_title')}
      />
    );
  }

  return (
    <MessageState
      body={t('deferred_routes.available_later')}
      title={t(`deferred_routes.${route}`)}
    />
  );
}
