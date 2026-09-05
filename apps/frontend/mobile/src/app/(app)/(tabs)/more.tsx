import { ProfileScreen } from '../../../features/profile/profile-screen';
import { useAuth } from '../../../shell/auth-provider';

export default function MoreRoute() {
  const { user, signOut } = useAuth();
  return user ? <ProfileScreen user={user} onSignOut={signOut} /> : null;
}
