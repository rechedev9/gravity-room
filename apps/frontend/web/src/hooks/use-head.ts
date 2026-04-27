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
    if (ogTitle !== undefined) cleanups.push(setMetaProperty('og:title', ogTitle));
    if (ogDescription !== undefined)
      cleanups.push(setMetaProperty('og:description', ogDescription));
    if (ogUrl !== undefined) cleanups.push(setMetaProperty('og:url', ogUrl));
    if (ogLocale !== undefined) cleanups.push(setMetaProperty('og:locale', ogLocale));

    return (): void => {
      cleanups.forEach((fn) => fn());
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogUrl, ogLocale, lang]);
}

export function useProgramHead(
  programId: string,
  name: string | undefined,
  description: string | undefined
): void {
  useHead({
    title: name !== undefined ? `${name} — Gravity Room` : DEFAULT_PAGE_TITLE,
    canonical: programId !== '' ? `https://gravityroom.app/programs/${programId}` : undefined,
    ogTitle: name !== undefined ? `${name} — Gravity Room` : undefined,
    ogDescription: description !== undefined ? description.slice(0, 200) : undefined,
    ogUrl: programId !== '' ? `https://gravityroom.app/programs/${programId}` : undefined,
  });
}
