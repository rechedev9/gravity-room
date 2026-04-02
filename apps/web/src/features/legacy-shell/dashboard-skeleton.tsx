import { HeaderSkeleton } from '@/components/header-skeleton';

export function DashboardSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh bg-body">
      <HeaderSkeleton />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="mb-10">
          <div className="h-3 w-24 bg-rule rounded mb-4 animate-pulse" />
          <div className="bg-card border border-rule p-5 sm:p-6 animate-pulse">
            <div className="h-5 w-48 bg-rule rounded mb-2" />
            <div className="h-3 w-64 bg-rule rounded mb-4" />
            <div className="h-2 w-full bg-rule rounded-full mb-4" />
            <div className="h-10 w-52 bg-rule rounded" />
          </div>
        </div>

        <div className="h-3 w-40 bg-rule rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-card border border-rule p-5 sm:p-6 animate-pulse">
              <div className="h-4 w-32 bg-rule rounded mb-2" />
              <div className="h-3 w-56 bg-rule rounded mb-4" />
              <div className="h-10 w-36 bg-rule rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
