import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
};

export const FormField = ({ label, hint, error, children, className }: FormFieldProps) => {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
};
