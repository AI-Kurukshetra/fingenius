"use client";

import { Badge } from "@/components/ui/badge";

type PasswordStrengthProps = {
  value: string;
};

const getScore = (value: string): number => {
  let score = 0;

  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return score;
};

const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];

export const PasswordStrength = ({ value }: PasswordStrengthProps) => {
  const score = Math.max(0, getScore(value) - 1);
  const progress = ((score + 1) / 5) * 100;

  const tone = score >= 4 ? "success" : score >= 2 ? "warning" : "danger";

  return (
    <div className="mt-2 space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${value ? progress : 0}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Use 8+ chars, number, symbol, mixed case</span>
        {value ? <Badge tone={tone}>{labels[score]}</Badge> : null}
      </div>
    </div>
  );
};
