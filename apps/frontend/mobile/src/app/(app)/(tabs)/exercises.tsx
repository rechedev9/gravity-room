import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../ui/screen';
import { type } from '../../../shell/design';

export default function ExercisesRoute() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text style={type.displaySm}>{t('nav.exercises')}</Text>
      <Text style={type.body}>{t('exercises.pending')}</Text>
    </Screen>
  );
}
