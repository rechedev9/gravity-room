import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { ScreenHeader } from '@/components/screen-header';
import { ProgramCatalog } from './program-catalog';

/** Phone "Explore" tab: the program catalog on its own, like the mobile templates screen. */
export function ExplorePage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle(t('programs.explore.page_title'));

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });
  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ScreenHeader
          className="mb-6"
          eyebrow={t('programs.catalog.eyebrow')}
          title={t('programs.catalog.title')}
          subtitle={t('programs.catalog.subtitle')}
        />
        <ProgramCatalog activeProgramId={activeProgram?.programId ?? null} />
      </div>
    </div>
  );
}
