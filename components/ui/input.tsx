import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export const Input = ({ className, hasError = false, ...props }: InputProps) => {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2",
        hasError
          ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
          : "border-slate-300 focus:border-teal-500 focus:ring-teal-100",
        className
      )}
      {...props}
    />
  );
};
