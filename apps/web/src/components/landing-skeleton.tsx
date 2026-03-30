export function LandingSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rule animate-pulse" />
          <div className="h-4 w-28 bg-rule rounded animate-pulse" />
        </div>
        <div className="hidden md:flex items-center gap-8">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-3 w-16 bg-rule rounded animate-pulse" />
          ))}
        </div>
      </nav>

      <div className="flex flex-col items-center px-6 pt-24 pb-12 sm:pt-32 sm:pb-16">
        <div className="h-16 w-72 sm:w-96 bg-rule rounded animate-pulse mb-4" />
        <div className="h-4 w-48 bg-rule rounded animate-pulse mb-8" />
        <div className="h-12 w-40 bg-rule rounded animate-pulse" />
      </div>
    </div>
  );
}
