import { HeaderSkeleton } from '@/components/header-skeleton';

export function ProfileSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <HeaderSkeleton />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="h-10 w-32 bg-rule rounded animate-pulse mb-6" />

        <div className="bg-card border border-rule p-5 mb-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="h-3 w-16 bg-rule rounded mb-2" />
              <div className="h-7 w-48 bg-rule rounded mb-1.5" />
              <div className="h-3 w-36 bg-rule rounded" />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="h-9 w-14 bg-rule rounded mb-1 mx-auto" />
                <div className="h-2.5 w-16 bg-rule rounded" />
              </div>
              <div className="text-center">
                <div className="h-9 w-14 bg-rule rounded mb-1 mx-auto" />
                <div className="h-2.5 w-10 bg-rule rounded" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-card border border-rule p-4 animate-pulse">
              <div className="h-3 w-20 bg-rule rounded mb-3" />
              <div className="h-7 w-14 bg-rule rounded" />
            </div>
          ))}
        </div>

        <div className="bg-card border border-rule p-4 animate-pulse">
          <div className="h-4 w-40 bg-rule rounded mb-4" />
          <div className="h-48 w-full bg-rule rounded" />
        </div>
      </div>
    </div>
  );
}
