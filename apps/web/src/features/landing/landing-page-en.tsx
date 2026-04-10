import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type CatalogEntry, fetchCatalogList } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { useScrollSpy } from '@/hooks/use-scroll-spy';
import { useHead } from '@/hooks/use-head';
import { trackEvent, getUtmProps } from '@/lib/analytics';
import { EN_CONTENT } from './content';
import {
  SECTION_IDS,
  CATALOG_STALE_TIME,
  GradientDivider,
  SkipToContent,
  Footer,
  LangBanner,
} from './shared';
import { NavBar } from './nav-bar';
import { HeroSection } from './hero-section';
import { MetricsSection } from './metrics-section';
import { FeaturesSection } from './features-section';
import { HowItWorksSection } from './how-it-works-section';
import { ScienceSection } from './science-section';
import { ProgramsSection } from './programs-section';
import { FinalCtaSection } from './final-cta-section';

export function LandingPageEn(): React.ReactNode {
  const activeSection = useScrollSpy(SECTION_IDS);

  useHead({
    title: 'Gravity Room — Weightlifting Programs with Automatic Progression',
    description:
      'Stop guessing at the gym. Follow proven weightlifting programs that automatically adjust weight, sets, and reps. 100% free.',
    canonical: 'https://gravityroom.app/en',
    ogLocale: 'en_US',
    ogTitle: 'Gravity Room — Weightlifting Programs with Automatic Progression',
    ogDescription:
      'Stop guessing at the gym. Follow proven weightlifting programs that automatically adjust weight, sets, and reps. 100% free.',
    ogUrl: 'https://gravityroom.app/en',
    lang: 'en',
  });

  // Track landing page view with UTM attribution on first mount
  useEffect(() => {
    trackEvent('landing_view', { lang: 'en', ...getUtmProps() });
  }, []);

  const catalogQuery = useQuery<readonly CatalogEntry[]>({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: CATALOG_STALE_TIME,
  });
  const catalog = catalogQuery.data;
  const programCount = catalog?.length ?? 0;
  const minDaysPerWeek =
    catalog && catalog.length > 0 ? Math.min(...catalog.map((p) => p.workoutsPerWeek)) : 0;
  const totalWorkouts = useMemo(
    () => catalog?.reduce((sum, p) => sum + p.totalWorkouts, 0) ?? 0,
    [catalog]
  );

  return (
    <div className="grain-overlay min-h-dvh bg-body overflow-x-hidden">
      <SkipToContent label={EN_CONTENT.skipLabel} />
      <LangBanner label={EN_CONTENT.langSwitch.label} href={EN_CONTENT.langSwitch.href} />
      <NavBar activeSection={activeSection} content={EN_CONTENT.nav} />

      <main id="main-content">
        <HeroSection content={EN_CONTENT.hero} />
        <GradientDivider />
        <MetricsSection
          programCount={programCount}
          minDaysPerWeek={minDaysPerWeek}
          totalWorkouts={totalWorkouts}
          content={EN_CONTENT.metrics}
        />
        <GradientDivider />
        <FeaturesSection content={EN_CONTENT.features} />
        <GradientDivider />
        <HowItWorksSection content={EN_CONTENT.howItWorks} />
        <GradientDivider />
        <ScienceSection content={EN_CONTENT.science} />
        <GradientDivider />
        <ProgramsSection catalogQuery={catalogQuery} content={EN_CONTENT.programs} />
        <GradientDivider />
        <FinalCtaSection content={EN_CONTENT.finalCta} />
      </main>

      <Footer content={EN_CONTENT.footer} navLinks={EN_CONTENT.nav.links} />
    </div>
  );
}
