import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main className="space-y-6 p-4 sm:p-6">
      <Card className="p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-96" />
      </Card>
      <Card className="p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-11 w-full" />
        <Skeleton className="mt-2 h-11 w-full" />
      </Card>
      <Card className="p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-52 w-full" />
      </Card>
    </main>
  );
}
