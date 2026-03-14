import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function OnboardingDetailLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <Card>
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded bg-slate-100" />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
