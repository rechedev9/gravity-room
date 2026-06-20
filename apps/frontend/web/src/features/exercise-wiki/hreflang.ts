/** Append <link rel="alternate" hreflang> tags to <head>; returns a cleanup that removes exactly them. */
export function appendHreflangAlternates(
  links: ReadonlyArray<{ readonly hreflang: string; readonly href: string }>
): () => void {
  const created = links.map(({ hreflang, href }) => {
    const el = document.createElement('link');
    el.rel = 'alternate';
    el.setAttribute('hreflang', hreflang);
    el.setAttribute('href', href);
    document.head.appendChild(el);
    return el;
  });
  return () => created.forEach((el) => el.remove());
}
