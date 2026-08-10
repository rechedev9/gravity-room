import { useEffect } from 'react';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

export interface HreflangAlternate {
  readonly hreflang: string;
  readonly href: string;
}

export interface HeadProps {
  readonly title?: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly ogTitle?: string;
  readonly ogDescription?: string;
  readonly ogUrl?: string;
  readonly ogLocale?: string;
  readonly lang?: string;
  readonly robots?: string;
  /**
   * Per-page `<link rel="alternate" hreflang>` set. Only emit these on pages
   * that genuinely have language-specific alternate URLs (landing, program
   * guides, exercise wiki). `undefined` explicitly clears any leftover
   * hreflang tags so SPA navigations and stale static tags cannot leak the
   * landing alternates onto single-URL pages (programs, legal, login).
   */
  readonly alternates?: readonly HreflangAlternate[];
}

function setMetaName(name: string, value: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const prev = el?.content;
  const created = el === null;
  if (el === null) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = value;
  const captured = el;
  return (): void => {
    if (created) {
      captured.remove();
    } else if (prev !== undefined) {
      captured.content = prev;
    }
  };
}

function setMetaProperty(property: string, value: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  const prev = el?.content;
  const created = el === null;
  if (el === null) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = value;
  const captured = el;
  return (): void => {
    if (created) {
      captured.remove();
    } else if (prev !== undefined) {
      captured.content = prev;
    }
  };
}

function setCanonical(href: string): () => void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const prev = el?.getAttribute('href');
  const created = el === null;
  if (el === null) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  const captured = el;
  return (): void => {
    if (created) {
      captured.remove();
    } else if (prev !== null && prev !== undefined) {
      captured.setAttribute('href', prev);
    }
  };
}

/** Remove every hreflang alternate currently in <head>. */
export function clearHreflangAlternates(): void {
  document.head
    .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
    .forEach((el) => {
      el.remove();
    });
}

/**
 * Replace the full hreflang set. Always clears first so React StrictMode
 * double-mounts and SPA navigations cannot stack duplicate triples.
 */
function setAlternates(alternates: readonly HreflangAlternate[]): () => void {
  clearHreflangAlternates();
  const created: HTMLLinkElement[] = [];
  for (const alt of alternates) {
    const el = document.createElement('link');
    el.rel = 'alternate';
    el.setAttribute('hreflang', alt.hreflang);
    el.setAttribute('href', alt.href);
    document.head.appendChild(el);
    created.push(el);
  }
  return (): void => {
    created.forEach((el) => el.remove());
  };
}

function resolveHtmlLang(lang: string | undefined): string | undefined {
  if (lang === undefined) return undefined;
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('es')) return 'es';
  return undefined;
}

function resolveOgLocale(lang: string | undefined): string | undefined {
  if (lang === undefined) return undefined;
  if (lang.startsWith('en')) return 'en_US';
  if (lang.startsWith('es')) return 'es_ES';
  return undefined;
}

export function useHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogUrl,
  ogLocale,
  lang,
  robots,
  alternates,
}: HeadProps): void {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (title !== undefined) {
      const prev = document.title;
      document.title = title;
      cleanups.push(() => {
        document.title = prev;
      });
    }

    if (lang !== undefined) {
      const prev = document.documentElement.lang;
      document.documentElement.lang = lang;
      cleanups.push(() => {
        document.documentElement.lang = prev;
      });
    }

    if (description !== undefined) cleanups.push(setMetaName('description', description));
    if (canonical !== undefined) cleanups.push(setCanonical(canonical));
    if (ogTitle !== undefined) {
      cleanups.push(setMetaProperty('og:title', ogTitle));
      // Mirror into the Twitter card — index.html ships a static twitter:title
      // (the landing copy), and Twitter/X only falls back to og:* when its own
      // tag is ABSENT. Without this, program/legal pages keep the landing card.
      cleanups.push(setMetaName('twitter:title', ogTitle));
    }
    if (ogDescription !== undefined) {
      cleanups.push(setMetaProperty('og:description', ogDescription));
      cleanups.push(setMetaName('twitter:description', ogDescription));
    }
    if (ogUrl !== undefined) cleanups.push(setMetaProperty('og:url', ogUrl));
    if (ogLocale !== undefined) cleanups.push(setMetaProperty('og:locale', ogLocale));
    if (robots !== undefined) cleanups.push(setMetaName('robots', robots));

    // Always own the hreflang surface: set the provided triple, or clear
    // leftovers so single-URL pages never inherit landing/wiki alternates.
    if (alternates !== undefined) {
      cleanups.push(setAlternates(alternates));
    } else {
      clearHreflangAlternates();
    }

    return (): void => {
      cleanups.forEach((fn) => fn());
    };
  }, [
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogUrl,
    ogLocale,
    lang,
    robots,
    alternates,
  ]);
}

export interface ProgramHeadOptions {
  /**
   * SEO-optimised, keyword-led title (e.g. "GZCLP Linear Progression…").
   * Preferred over the themed program name for the indexed `<title>`/og:title
   * so high-intent queries match the real program, not the Dragon-Ball lore.
   */
  readonly seoTitle?: string;
  /**
   * SEO-optimised, factual `<meta name="description">`/og:description. Replaces
   * the themed program description (lore) in the indexed snippet that search +
   * AI answer engines extract.
   */
  readonly seoDescription?: string;
  /**
   * UI language (i18n.language) — drives `lang`, `og:locale`, and SEO copy so
   * all head signals stay consistent (no es html + en_US og mismatch).
   */
  readonly lang?: string;
}

export function useProgramHead(
  programId: string,
  name: string | undefined,
  description: string | undefined,
  options: ProgramHeadOptions = {}
): void {
  const { seoTitle, seoDescription, lang } = options;
  const themedTitle = name !== undefined ? `${name} — Gravity Room` : undefined;
  const title = seoTitle ?? themedTitle ?? DEFAULT_PAGE_TITLE;
  const metaDescription =
    seoDescription ?? (description !== undefined ? description.slice(0, 200) : undefined);
  const url = programId !== '' ? `https://gravityroom.app/programs/${programId}` : undefined;
  const htmlLang = resolveHtmlLang(lang);
  const ogLocale = resolveOgLocale(lang);

  useHead({
    title,
    // Set a route-specific <meta name="description"> too (not just og:*) — until
    // now program pages inherited the landing's generic description in the
    // indexed snippet.
    description: metaDescription,
    canonical: url,
    ogTitle: seoTitle ?? themedTitle,
    ogDescription: metaDescription,
    ogUrl: url,
    ogLocale,
    lang: htmlLang,
    // Single-URL catalog pages: no language alternate pair. Explicitly leave
    // alternates undefined so useHead clears any leaked landing hreflang.
  });
}
