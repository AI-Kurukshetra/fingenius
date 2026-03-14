import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200", className)} {...props} />;
};
