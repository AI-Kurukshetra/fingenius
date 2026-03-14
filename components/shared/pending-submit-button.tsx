"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isLoading?: boolean;
  disabled?: boolean;
};

export const PendingSubmitButton = ({
  label,
  pendingLabel,
  className,
  variant = "primary",
  isLoading,
  disabled
}: PendingSubmitButtonProps) => {
  const { pending } = useFormStatus();
  const loading = isLoading ?? pending;

  return (
    <Button className={className} disabled={disabled || loading} type="submit" variant={variant}>
      {loading ? pendingLabel ?? "Working..." : label}
    </Button>
  );
};
