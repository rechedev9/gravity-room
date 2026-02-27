/**
 * Full-page skeleton shown while auth state is being restored.
 * Mirrors AppHeader + Toolbar + 3 workout row placeholders so the layout
 * doesn't shift once auth resolves and real content mounts.
 */
export function AppSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      {/* Header skeleton */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 bg-header border-b border-rule">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-rule animate-pulse" />
          <div className="h-3.5 w-48 bg-rule rounded animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-rule animate-pulse" />
      </header>

      {/* Toolbar skeleton */}
      <div className="bg-card border-b border-rule px-3 sm:px-5 py-2 sm:py-3">
        {/* Mobile: progress bar above buttons */}
        <div className="h-2.5 bg-progress-track rounded-full animate-pulse mb-2 sm:hidden" />
        <div className="flex items-center gap-4">
          <div className="h-8 w-20 bg-rule rounded animate-pulse" />
          <div className="flex-1 h-2.5 bg-progress-track rounded-full animate-pulse hidden sm:block" />
          <div className="h-8 w-8 bg-rule rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton — 3 workout row placeholders */}
      <div className="max-w-[1300px] mx-auto px-5 pt-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-card border border-rule mb-3 p-4 sm:p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-4 w-16 bg-rule rounded" />
              <div className="h-3 w-32 bg-rule rounded" />
            </div>
            <div className="flex gap-4">
              <div className="h-3 w-20 bg-rule rounded" />
              <div className="h-3 w-20 bg-rule rounded" />
              <div className="h-3 w-20 bg-rule rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
