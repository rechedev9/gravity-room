/** Placeholder for the ScreenHeader (kicker + display title) while a route chunk loads. */
export function HeaderSkeleton(): React.ReactNode {
  return (
    <header className="px-5 pt-6 sm:px-8 sm:pt-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="h-2.5 w-20 animate-pulse rounded bg-rule" />
        <div className="h-8 w-48 animate-pulse rounded bg-rule" />
      </div>
    </header>
  );
}
