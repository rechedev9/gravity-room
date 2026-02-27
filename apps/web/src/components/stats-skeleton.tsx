import type { ReactNode } from 'react';

function PulseCard(): ReactNode {
  return (
    <div className="bg-th border border-rule p-4 animate-pulse">
      <div className="h-3 w-24 bg-rule rounded mb-3" />
      <div className="h-7 w-16 bg-rule rounded mb-2" />
      <div className="h-3 w-full bg-rule rounded" />
    </div>
  );
}

function PulseChart(): ReactNode {
  return (
    <div className="bg-th border border-rule p-4 animate-pulse">
      <div className="h-4 w-40 bg-rule rounded mb-4" />
      <div className="flex items-end gap-2 h-32">
        {[40, 65, 50, 80, 55, 70, 90, 60, 75, 85].map((h, i) => (
          <div key={i} className="flex-1 bg-rule rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton(): ReactNode {
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <PulseCard />
        <PulseCard />
        <PulseCard />
        <PulseCard />
      </div>
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <PulseChart />
        <PulseChart />
        <PulseChart />
        <PulseChart />
      </div>
    </div>
  );
}
