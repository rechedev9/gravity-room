import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PresetSetupScreen } from '../../../features/programs/preset-setup-screen';
import {
  createProgramRoute,
  parseProgramId,
  PRIMARY_TAB_ROUTES,
  returnFromSecondaryRoute,
} from '../../../navigation/routes';
import { useAuth } from '../../../providers/auth-provider';
import { MessageState } from '../../../ui/message-state';

export default function NewProgramRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ programId?: string | string[] }>();
  const programId = parseProgramId(params.programId);

  if (user === null) {
    return null;
  }

  if (programId === null) {
    return (
      <MessageState
        actionAccessibilityLabel={t('common.back_accessibility')}
        actionLabel={t('common.back')}
        body={t('programs.preset.invalid_body')}
        onAction={() => router.replace(PRIMARY_TAB_ROUTES.programs)}
        title={t('programs.preset.invalid_title')}
      />
    );
  }

  return (
    <PresetSetupScreen
      onBack={() => returnFromSecondaryRoute(router)}
      onCreated={(programInstanceId) => router.replace(createProgramRoute(programInstanceId))}
      ownerUserId={user.id}
      programId={programId}
    />
  );
}
