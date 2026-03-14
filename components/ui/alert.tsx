import { cn } from "@/lib/utils";

type AlertTone = "error" | "success" | "info";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
};

const toneStyles: Record<AlertTone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-cyan-200 bg-cyan-50 text-cyan-700"
};

export const Alert = ({ className, tone = "info", ...props }: AlertProps) => {
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-sm", toneStyles[tone], className)} {...props} />
  );
};
