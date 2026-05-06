import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type CatalogEntry, fetchCatalogList } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { useScrollSpy } from '@/hooks/use-scroll-spy';
import { useHead } from '@/hooks/use-head';
import { trackEvent, getUtmProps } from '@/lib/analytics';
import type { LandingContent } from './content';
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
import { ProblemSection } from './problem-section';
import { MidPageCtaSection } from './mid-page-cta-section';
import { FreeTrustSection } from './free-trust-section';
import { ComparisonSection } from './comparison-section';
import { FaqSection } from './faq-section';
import type { HeadProps } from '@/hooks/use-head';

interface LandingPageShellProps {
  readonly content: LandingContent;
  readonly head: HeadProps;
  readonly lang: 'es' | 'en';
}

export function LandingPageShell({ content, head, lang }: LandingPageShellProps): React.ReactNode {
  const activeSection = useScrollSpy(SECTION_IDS);

  useHead(head);

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent('landing_view', { lang, ...getUtmProps() });
  }, [lang]);

  const catalogQuery = useQuery<readonly CatalogEntry[]>({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: CATALOG_STALE_TIME,
  });
  const catalog = catalogQuery.data;
  const programCount = catalog?.length ?? 0;
  const minDaysPerWeek = useMemo(
    () => (catalog && catalog.length > 0 ? Math.min(...catalog.map((p) => p.workoutsPerWeek)) : 0),
    [catalog]
  );
  const totalWorkouts = useMemo(
    () => catalog?.reduce((sum, p) => sum + p.totalWorkouts, 0) ?? 0,
    [catalog]
  );

  return (
    <div className="grain-overlay min-h-dvh bg-body overflow-x-hidden">
      <SkipToContent label={content.skipLabel} />
      <LangBanner label={content.langSwitch.label} href={content.langSwitch.href} />
      <NavBar activeSection={activeSection} content={content.nav} />

      <main id="main-content">
        <HeroSection content={content.hero} productPreview={content.productPreview} />
        <GradientDivider />
        <ProblemSection content={content.problem} />
        <GradientDivider />
        <MetricsSection
          programCount={programCount}
          minDaysPerWeek={minDaysPerWeek}
          totalWorkouts={totalWorkouts}
          content={content.metrics}
        />
        <GradientDivider />
        <HowItWorksSection content={content.howItWorks} />
        <MidPageCtaSection content={content.midPageCta} />
        <GradientDivider />
        <FeaturesSection content={content.features} />
        <GradientDivider />
        <ProgramsSection catalogQuery={catalogQuery} content={content.programs} />
        <GradientDivider />
        <ScienceSection content={content.science} />
        <GradientDivider />
        <FreeTrustSection content={content.freeTrust} />
        <GradientDivider />
        <ComparisonSection content={content.comparison} />
        <GradientDivider />
        <FaqSection content={content.faq} />
        <GradientDivider />
        <FinalCtaSection content={content.finalCta} />
      </main>

      <Footer content={content.footer} navLinks={content.nav.links} />
    </div>
  );
}
