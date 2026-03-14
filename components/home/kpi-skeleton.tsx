import { Skeleton } from "@/components/ui/skeleton";

export const KpiSkeleton = () => {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="rounded-2xl border border-slate-200 bg-white p-4" key={`kpi-skeleton-${index}`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
};
