import { lazy, Suspense, useMemo, useEffect, useRef } from 'react';
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
import { ProblemSection } from './problem-section';
import { MidPageCtaSection } from './mid-page-cta-section';
import { FreeTrustSection } from './free-trust-section';
import { FinalCtaSection } from './final-cta-section';
import type { HeadProps } from '@/hooks/use-head';

// Below-the-fold sections — lazy-loaded so the initial landing payload only
// carries the hero + first two sections. The Suspense fallback is `null`
// because the sections animate in on scroll anyway.
const FeaturesSection = lazy(() =>
  import('./features-section').then((m) => ({ default: m.FeaturesSection }))
);
const HowItWorksSection = lazy(() =>
  import('./how-it-works-section').then((m) => ({ default: m.HowItWorksSection }))
);
const ScienceSection = lazy(() =>
  import('./science-section').then((m) => ({ default: m.ScienceSection }))
);
const ProgramsSection = lazy(() =>
  import('./programs-section').then((m) => ({ default: m.ProgramsSection }))
);
const ComparisonSection = lazy(() =>
  import('./comparison-section').then((m) => ({ default: m.ComparisonSection }))
);
const FaqSection = lazy(() => import('./faq-section').then((m) => ({ default: m.FaqSection })));

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
        <HeroSection content={content.hero} />
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
        <Suspense fallback={null}>
          <HowItWorksSection content={content.howItWorks} />
        </Suspense>
        <MidPageCtaSection content={content.midPageCta} />
        <GradientDivider />
        <Suspense fallback={null}>
          <FeaturesSection content={content.features} />
          <GradientDivider />
          <ProgramsSection catalogQuery={catalogQuery} content={content.programs} />
          <GradientDivider />
          <ScienceSection content={content.science} />
        </Suspense>
        <GradientDivider />
        <FreeTrustSection content={content.freeTrust} />
        <GradientDivider />
        <Suspense fallback={null}>
          <ComparisonSection content={content.comparison} />
          <GradientDivider />
          <FaqSection content={content.faq} />
        </Suspense>
        <GradientDivider />
        <FinalCtaSection content={content.finalCta} />
      </main>

      <Footer content={content.footer} navLinks={content.nav.links} />
    </div>
  );
}
