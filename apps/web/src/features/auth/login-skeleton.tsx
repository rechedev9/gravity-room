export function LoginSkeleton(): React.ReactNode {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-body px-5 py-12">
      <div className="w-17 h-17 rounded-full bg-rule animate-pulse mb-7" />
      <div className="h-16 w-64 bg-rule rounded animate-pulse mb-1" />
      <div className="w-full max-w-[300px] bg-card border border-rule p-[22px] animate-pulse mt-7">
        <div className="h-3 w-20 bg-rule rounded mb-5" />
        <div className="h-12 w-full bg-rule rounded" />
      </div>
      <div className="h-3 w-32 bg-rule rounded animate-pulse mt-5" />
    </div>
  );
}
