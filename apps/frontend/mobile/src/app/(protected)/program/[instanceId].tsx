import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TrackerScreen } from '../../../features/tracker/tracker-screen';
import {
  parseProgramInstanceId,
  PRIMARY_TAB_ROUTES,
  returnFromProgramRoute,
} from '../../../navigation/routes';
import { MessageState } from '../../../ui/message-state';

export default function ProgramTrackerRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ instanceId?: string | string[] }>();
  const programInstanceId = parseProgramInstanceId(params.instanceId);

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
      programInstanceId={programInstanceId}
      onBack={() => returnFromProgramRoute(router)}
    />
  );
}
