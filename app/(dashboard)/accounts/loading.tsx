import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <main className="space-y-6 p-4 sm:p-6">
      <Card className="p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-96" />
      </Card>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-64 w-full" />
        </Card>
      </div>
    </main>
  );
}
