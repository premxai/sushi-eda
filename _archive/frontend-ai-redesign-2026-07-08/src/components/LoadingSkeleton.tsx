import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Quality Score Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <Skeleton className="h-6 w-48" />
        <div className="mt-4 flex items-baseline gap-3">
          <Skeleton className="h-16 w-24" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
            <Skeleton className="mt-1 h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Data Types Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Skeleton className="h-5 w-32" />
        <div className="mt-3 space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ColumnCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
