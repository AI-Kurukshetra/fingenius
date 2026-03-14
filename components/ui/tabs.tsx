"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type TabItem = {
  key: string;
  label: string;
  content: React.ReactNode;
};

type TabsProps = {
  items: TabItem[];
  defaultKey?: string;
  className?: string;
};

export const Tabs = ({ items, defaultKey, className }: TabsProps) => {
  const initial = useMemo(() => defaultKey ?? items[0]?.key ?? "", [defaultKey, items]);
  const [activeKey, setActiveKey] = useState(initial);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.key === activeKey;

          return (
            <button
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "border-teal-600 bg-teal-600 text-white shadow-[0_8px_20px_-12px_rgba(13,148,136,0.8)]"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              )}
              key={item.key}
              onClick={() => setActiveKey(item.key)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        if (item.key !== activeKey) {
          return null;
        }

        return <div key={item.key}>{item.content}</div>;
      })}
    </div>
  );
};
