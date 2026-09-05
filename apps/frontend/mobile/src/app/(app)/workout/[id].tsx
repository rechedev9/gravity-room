import { Redirect, useLocalSearchParams } from 'expo-router';

// All entry points share Train's tracker so retained tabs cannot edit stale copies.
export default function WorkoutDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/', params: { id } }} />;
}
