/* ── LandingArtwork ──────────────────────────────────────────────────────────
 * Shared figure wrapper for the landing page's emotional artwork images.
 *
 * Renders a single cinematic image inside a framed figure with a caption. It is
 * used both for the hero artwork (above the fold) and the features artwork
 * (below the fold); the two differ only in their loading strategy.
 *
 * The `eager` flag selects that strategy:
 *   eager=true  — the hero image, which is the landing's LCP candidate: loaded
 *                 with high fetch priority and NO lazy loading.
 *   eager falsy — below-the-fold artwork (e.g. features): lazy-loaded so it
 *                 doesn't compete with the LCP image for bandwidth.
 *
 * Props:
 *   src     — image URL
 *   width   — intrinsic pixel width (reserves space, prevents layout shift)
 *   height  — intrinsic pixel height (reserves space, prevents layout shift)
 *   alt     — accessible alt text for the artwork
 *   caption — visible caption label under the figure
 *   eager   — LCP eager-load flag (see above); defaults to lazy
 * ─────────────────────────────────────────────────────────────────────────── */

interface LandingArtworkProps {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly caption: string;
  readonly eager?: boolean;
}

export function LandingArtwork({
  src,
  width,
  height,
  alt,
  caption,
  eager = false,
}: LandingArtworkProps): React.ReactNode {
  return (
    <figure className="relative max-w-md mx-auto">
      <div className="landing-hero-art overflow-hidden rounded-sm border border-rule">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          loading={eager ? undefined : 'lazy'}
          className="w-full h-auto block"
        />
      </div>
      <figcaption className="mt-3 text-center font-mono text-[10px] text-muted tracking-wider uppercase">
        {caption}
      </figcaption>
    </figure>
  );
}
