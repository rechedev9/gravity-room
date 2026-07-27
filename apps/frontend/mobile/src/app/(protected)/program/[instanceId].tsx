import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TrackerScreen } from '../../../features/tracker/tracker-screen';
import {
  parseProgramInstanceId,
  PRIMARY_TAB_ROUTES,
  returnFromProgramRoute,
} from '../../../navigation/routes';
import { useAuth } from '../../../providers/auth-provider';
import { MessageState } from '../../../ui/message-state';

export default function ProgramTrackerRoute() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ instanceId?: string | string[] }>();
  const programInstanceId = parseProgramInstanceId(params.instanceId);

  if (user === null) {
    return null;
  }

  if (programInstanceId === null) {
    return (
      <MessageState
        actionAccessibilityLabel={t('tracker.invalid_program_back_accessibility')}
        actionLabel={t('tracker.back')}
        body={t('tracker.invalid_program_body')}
        onAction={() => router.replace(PRIMARY_TAB_ROUTES.programs)}
        title={t('tracker.invalid_program_title')}
      />
    );
  }

  return (
    <TrackerScreen
      ownerUserId={user.id}
      programInstanceId={programInstanceId}
      onBack={() => returnFromProgramRoute(router)}
    />
  );
}
