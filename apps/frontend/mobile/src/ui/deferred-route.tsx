import { useTranslation } from 'react-i18next';

import { MessageState } from './message-state';

export type DeferredRouteName =
  | 'program_new'
  | 'program_editor'
  | 'workout_history'
  | 'workout_session'
  | 'exercise_index'
  | 'exercise_detail'
  | 'sync';

interface DeferredRouteProps {
  readonly onExit: () => void;
  readonly route: DeferredRouteName;
  readonly validIdentifier?: boolean;
}

export function DeferredRoute({ onExit, route, validIdentifier = true }: DeferredRouteProps) {
  const { t } = useTranslation();

  if (!validIdentifier) {
    return (
      <MessageState
        actionAccessibilityLabel={t('deferred_routes.back_accessibility')}
        actionLabel={t('deferred_routes.back')}
        body={t('deferred_routes.invalid_body')}
        onAction={onExit}
        title={t('deferred_routes.invalid_title')}
      />
    );
  }

  return (
    <MessageState
      actionAccessibilityLabel={t('deferred_routes.back_accessibility')}
      actionLabel={t('deferred_routes.back')}
      body={t('deferred_routes.available_later')}
      onAction={onExit}
      title={t(`deferred_routes.${route}`)}
    />
  );
}
