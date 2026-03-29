import { useQuery } from '@tanstack/react-query';
import { type CatalogEntry, fetchCatalogList } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { useScrollSpy } from '@/hooks/use-scroll-spy';
import { useOnlineCount } from '@/hooks/use-online-count';
import { SECTION_IDS, CATALOG_STALE_TIME, GradientDivider, SkipToContent, Footer } from './shared';
import { NavBar } from './nav-bar';
import { HeroSection } from './hero-section';
import { MetricsSection } from './metrics-section';
import { FeaturesSection } from './features-section';
import { HowItWorksSection } from './how-it-works-section';
import { ScienceSection } from './science-section';
import { ProgramsSection } from './programs-section';
import { FinalCtaSection } from './final-cta-section';

export function LandingPage(): React.ReactNode {
  const activeSection = useScrollSpy(SECTION_IDS);

  const catalogQuery = useQuery<readonly CatalogEntry[]>({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: CATALOG_STALE_TIME,
  });
  const catalog = catalogQuery.data;
  const programCount = catalog?.length ?? 0;
  const minDaysPerWeek =
    catalog && catalog.length > 0 ? Math.min(...catalog.map((p) => p.workoutsPerWeek)) : 0;
  const onlineCount = useOnlineCount();

  return (
    <div className="grain-overlay min-h-dvh bg-body overflow-x-hidden">
      <SkipToContent />
      <NavBar activeSection={activeSection} />

      <main id="main-content">
        <HeroSection />
        <GradientDivider />
        <MetricsSection
          programCount={programCount}
          minDaysPerWeek={minDaysPerWeek}
          onlineCount={onlineCount}
        />
        <GradientDivider />
        <FeaturesSection />
        <GradientDivider />
        <HowItWorksSection />
        <GradientDivider />
        <ScienceSection />
        <GradientDivider />
        <ProgramsSection catalogQuery={catalogQuery} />
        <GradientDivider />
        <FinalCtaSection />
      </main>

      <Footer />
    </div>
  );
}
