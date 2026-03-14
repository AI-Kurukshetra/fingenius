import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur",
        className
      )}
      {...props}
    />
  );
};

export const CardHeader = ({ className, ...props }: CardProps) => {
  return <div className={cn("border-b border-slate-100 px-5 py-4", className)} {...props} />;
};

export const CardBody = ({ className, ...props }: CardProps) => {
  return <div className={cn("px-5 py-4", className)} {...props} />;
};

export const CardFooter = ({ className, ...props }: CardProps) => {
  return <div className={cn("border-t border-slate-100 px-5 py-4", className)} {...props} />;
};
