"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CounterItem = {
  id: string;
  label: string;
  value: number;
  description: string;
  prefix?: string;
  suffix?: string;
};

type AnimatedCounterGridProps = {
  items: CounterItem[];
  className?: string;
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("en-US").format(value);
};

export const AnimatedCounterGrid = ({ items, className }: AnimatedCounterGridProps) => {
  const targets = useMemo(() => items.map((item) => Math.max(item.value, 0)), [items]);
  const [values, setValues] = useState<number[]>(() => targets.map(() => 0));

  useEffect(() => {
    const animationDuration = 800;
    const start = performance.now();
    let frame = 0;

    const step = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / animationDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValues(targets.map((target) => Math.round(target * eased)));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [targets]);

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, index) => (
        <Card
          className="group border-slate-200/80 bg-white/95 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_20px_40px_-30px_rgba(6,182,212,0.8)]"
          key={item.id}
        >
          <CardBody className="space-y-1 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="text-2xl font-semibold text-slate-900">
              {item.prefix}
              {formatNumber(values[index] ?? 0)}
              {item.suffix}
            </p>
            <p className="text-xs text-slate-500">{item.description}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};
