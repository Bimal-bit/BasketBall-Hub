export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gray-800 p-4 ${className}`}>
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-700" />
      <div className="h-4 w-1/2 rounded bg-gray-700" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}
