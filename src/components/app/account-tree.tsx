"use client";

import * as React from "react";
import { cn, formatBirr } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { subAccountName, type PaymentMethod } from "@/lib/accounts";

export interface SubBalance { detail: string | null; amount: number; }
export interface AccountTree { total: number; subAccounts: SubBalance[]; }

// Renders a single account (Cash/Mobile/Bank) as a card with the total on top
// and a tree of sub-accounts underneath (Telebirr, M-Pesa, CBE, United, Zemen…).
export function AccountTreeCard({
  method,
  label,
  tree,
  currency = "Br",
  defaultOpen = false,
  tone = "default",
}: {
  method: PaymentMethod;
  label: string;
  tree: AccountTree;
  currency?: string;
  defaultOpen?: boolean;
  tone?: "default" | "emerald" | "sky" | "violet";
}) {
  const [open, setOpen] = React.useState(defaultOpen || tree.subAccounts.length > 1);
  const hasSubs = tree.subAccounts.length > 0;
  const showToggle = hasSubs && (method !== "CASH");

  const toneCls = {
    default: "",
    emerald: "from-emerald-500/12 to-emerald-500/3 ring-emerald-500/20",
    sky: "from-sky-500/12 to-sky-500/3 ring-sky-500/20",
    violet: "from-violet-500/12 to-violet-500/3 ring-violet-500/20",
  }[tone];

  const dotColor = method === "CASH" ? "bg-emerald-400" : method === "MOBILE" ? "bg-sky-400" : "bg-violet-400";

  return (
    <Card className={cn("bg-gradient-to-br p-3 ring-1", toneCls)}>
      <button
        type="button"
        disabled={!showToggle}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center justify-between gap-2 text-left", showToggle && "tap-scale")}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
        </span>
        <span className={cn("text-sm font-bold tnum tracking-tight", tree.total < 0 && "text-red-400")}>
          {formatBirr(tree.total, currency)}
        </span>
      </button>

      {showToggle && open && hasSubs && (
        <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
          {tree.subAccounts.map((s, i) => (
            <div key={(s.detail ?? "") + i} className="flex items-center justify-between gap-2 pl-3 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                <span className="truncate text-muted-foreground">
                  {s.detail ? subAccountName(method, s.detail) : (method === "CASH" ? "Drawer" : "Unspecified")}
                </span>
              </span>
              <span className={cn("shrink-0 font-semibold tnum", s.amount < 0 ? "text-red-400" : "text-foreground/90")}>
                {formatBirr(s.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
      {showToggle && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1.5 flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {open ? "Hide breakdown" : `Show ${tree.subAccounts.length} sub-account${tree.subAccounts.length > 1 ? "s" : ""}`}
          <svg viewBox="0 0 24 24" className={cn("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
    </Card>
  );
}
