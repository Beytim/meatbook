"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  subAccountsFor, type PaymentMethod,
} from "@/lib/accounts";

// A compact dropdown for choosing the sub-account (Telebirr/M-Pesa/CBE/United/Zemen…)
// based on the selected payment method. For CASH it's hidden.
// Auto-detects whether to open up or down based on available space — important
// inside bottom drawers where there's no room below.
export function AccountProviderSelect({
  method,
  value,
  onChange,
  className,
}: {
  method: PaymentMethod;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [dropUp, setDropUp] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Measure available space and decide direction.
  React.useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // Need ~260px for the dropdown; if not enough below, open upward.
    setDropUp(spaceBelow < 280);
  }, [open]);

  if (method === "CASH") return null;

  const options = subAccountsFor(method);
  const current = options.find((o) => o.id === value || o.name === value || o.short === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 text-left text-xs tap-scale focus:border-primary/50 focus:outline-none",
          !current && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          {current ? (
            <>
              <MethodDot method={method} />
              <span className="font-medium">{current.short || current.name}</span>
            </>
          ) : (
            <>
              <MethodDot method={method} />
              <span>Choose {method === "MOBILE" ? "provider" : "bank"}…</span>
            </>
          )}
        </span>
        <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && (dropUp ? "rotate-180" : "rotate-180"))} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-[100] max-h-64 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-2xl mb-scroll",
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.name); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs tap-scale hover:bg-muted/70",
                value === o.id || value === o.name || value === o.short ? "bg-primary/10" : ""
              )}
            >
              <MethodDot method={method} />
              <span className="flex-1">
                <span className="block font-medium">{o.name}</span>
                {o.short && o.short !== o.name && <span className="block text-[10px] text-muted-foreground">{o.short}</span>}
              </span>
              {(value === o.id || value === o.name || value === o.short) && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodDot({ method }: { method: PaymentMethod }) {
  const color = method === "CASH" ? "bg-emerald-400" : method === "MOBILE" ? "bg-sky-400" : "bg-violet-400";
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />;
}
