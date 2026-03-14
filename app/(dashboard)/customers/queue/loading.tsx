export default function QueueLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="h-12 animate-pulse bg-slate-50" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse border-t border-slate-100 bg-white" />
        ))}
      </div>
    </div>
  );
}
