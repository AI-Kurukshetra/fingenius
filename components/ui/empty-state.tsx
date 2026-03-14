import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState = ({ title, description, action, className }: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center",
        className
      )}
    >
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};
