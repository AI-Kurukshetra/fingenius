import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white/70 p-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-12 w-full max-w-xl" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-3 h-4 w-72" />
          <Skeleton className="mt-8 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-6 h-11 w-full" />
        </section>
      </div>
    </main>
  );
}
