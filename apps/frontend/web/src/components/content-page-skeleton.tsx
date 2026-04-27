export function ContentPageSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <header className="bg-header border-b border-rule px-6 sm:px-10 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="h-4 w-16 bg-rule rounded animate-pulse" />
          <div className="h-4 w-28 bg-rule rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
        <div className="h-8 w-64 bg-rule rounded animate-pulse mb-8" />
        <div className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 w-40 bg-rule rounded mb-3" />
              <div className="h-3 w-full bg-rule rounded mb-2" />
              <div className="h-3 w-5/6 bg-rule rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
