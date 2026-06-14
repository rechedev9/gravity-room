import { useEffect } from 'react';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

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
      // Mirror into the Twitter card — without this, prerendered subpages keep
      // the static landing `twitter:title` from index.html (Twitter only falls
      // back to og:* when its own tag is absent, and the default is present).
      cleanups.push(setMetaName('twitter:title', ogTitle));
    }
    if (ogDescription !== undefined) {
      cleanups.push(setMetaProperty('og:description', ogDescription));
      cleanups.push(setMetaName('twitter:description', ogDescription));
    }
    if (ogUrl !== undefined) cleanups.push(setMetaProperty('og:url', ogUrl));
    if (ogLocale !== undefined) cleanups.push(setMetaProperty('og:locale', ogLocale));
    if (robots !== undefined) cleanups.push(setMetaName('robots', robots));

    return (): void => {
      cleanups.forEach((fn) => fn());
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogUrl, ogLocale, lang, robots]);
}

export function useProgramHead(
  programId: string,
  name: string | undefined,
  description: string | undefined,
  lang?: string
): void {
  const desc = description !== undefined ? description.slice(0, 200) : undefined;
  const ogLocale = lang?.startsWith('en') ? 'en_US' : lang?.startsWith('es') ? 'es_ES' : undefined;
  useHead({
    title: name !== undefined ? `${name} — Gravity Room` : DEFAULT_PAGE_TITLE,
    description: desc,
    canonical: programId !== '' ? `https://gravityroom.app/programs/${programId}` : undefined,
    ogTitle: name !== undefined ? `${name} — Gravity Room` : undefined,
    ogDescription: desc,
    ogUrl: programId !== '' ? `https://gravityroom.app/programs/${programId}` : undefined,
    ogLocale,
  });
}
