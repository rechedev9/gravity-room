import { ProfileScreen } from '../../../features/profile/profile-screen';
import { useAuth } from '../../../providers/auth-provider';

export default function ProfileRoute() {
  const { signOut, user } = useAuth();

  if (user === null) {
    return null;
  }

  return <ProfileScreen user={user} onSignOut={signOut} />;
}
