export function HeaderSkeleton(): React.ReactNode {
  return (
    <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 bg-header border-b border-rule">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-rule animate-pulse" />
        <div className="h-3.5 w-48 bg-rule rounded animate-pulse" />
      </div>
      <div className="w-8 h-8 rounded-full bg-rule animate-pulse" />
    </header>
  );
}
