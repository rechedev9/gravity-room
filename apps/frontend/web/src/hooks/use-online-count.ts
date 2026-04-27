import { useQuery } from '@tanstack/react-query';
import { fetchOnlineCount } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';

const REFETCH_INTERVAL_MS = 30_000;

export function useOnlineCount(): number | null {
  const { data } = useQuery({
    queryKey: queryKeys.stats.online,
    queryFn: fetchOnlineCount,
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
  });
  return data ?? null;
}
