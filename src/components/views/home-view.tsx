"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { formatBirr, formatKg, formatTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/app/primitives";
import { AccountTreeCard, type AccountTree } from "@/components/app/account-tree";
import { animalName, animalEmoji, animalTone } from "@/lib/animals";

interface DashboardData {
  settings: { shopName: string; currency: string };
  today: {
    salesCount: number;
    revenue: number;
    kgSold: number;
    takeHome: { revenue: number; count: number; kg: number };
    eatHere: { revenue: number; count: number; kg: number };
  };
  lastSaleNumber: number | null;
  openSession: { id: string; opening: number; openedAt: string; openedBy: string | null } | null;
  accounts: { cash: number; mobile: number; bank: number };
  tree: { CASH: AccountTree; MOBILE: AccountTree; BANK: AccountTree };
  flow: {
    todayKgSold: number;
    purchaseKg: number;
    purchaseAmount: number;
    todayExpenses: number;
    todayRevenue: number;
    profit: number;
    profitMargin: number;
    profitStatus: "loss" | "break_even" | "healthy";
    purchaseCoverage: number;
    kgRatio: number;
  };
  todayPurchases: {
    count: number;
    total: number;
    totalKg: number;
    animalBreakdown: { type: string; kg: number; amount: number; count: number; perKg: number }[];
  };
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/meat/dashboard");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function HomeView() {
  const go = useNav((s) => s.go);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) return <div className="p-8 text-center text-sm text-muted-foreground">Could not load dashboard.</div>;

  const cur = data.settings.currency;
  const today = data.today;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        <QuickAction label="Sell" tone="primary" onClick={() => go("SELL")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>
        } />
        <QuickAction label="Expense" onClick={() => go("EXPENSES")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h20v12H2z M2 11h20" /></svg>
        } />
        <QuickAction label="Purchase" onClick={() => go("PURCHASES")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18 M7 10l3 3 4-5" /></svg>
        } />
        <QuickAction label="Waste" onClick={() => go("WASTAGE")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 5a3.5 3.5 0 0 1 0 5l-5 5a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0z M9 9l6 6" /></svg>
        } />
      </div>

      {/* Today's sales hero */}
      <Card className="mb-4 overflow-hidden card-raised">
        <div className="relative bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Sales</p>
              <p className="mt-1 text-3xl font-bold tnum tracking-tight">{formatBirr(today.revenue, cur)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {today.salesCount} {today.salesCount === 1 ? "sale" : "sales"} · {formatKg(today.kgSold)} sold
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/20 text-primary ring-1 ring-primary/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Take Home</p>
            </div>
            <p className="mt-1 text-lg font-bold tnum">{formatBirr(today.takeHome.revenue, cur)}</p>
            <p className="text-[11px] text-muted-foreground">{today.takeHome.count} sales · {formatKg(today.takeHome.kg)}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eat Here</p>
            </div>
            <p className="mt-1 text-lg font-bold tnum">{formatBirr(today.eatHere.revenue, cur)}</p>
            <p className="text-[11px] text-muted-foreground">{today.eatHere.count} sales · {formatKg(today.eatHere.kg)}</p>
          </div>
        </div>
      </Card>

      {/* ─── Stock & Money Flow: did today's sales cover today's purchases? ─── */}
      <StockFlowCard flow={data.flow} cur={cur} />

      {/* ─── Today's Purchases — animal-type breakdown ─── */}
      {data.todayPurchases.count > 0 && (
        <TodayPurchasesCard purchases={data.todayPurchases} cur={cur} onOpen={() => go("PURCHASES")} />
      )}

      {/* Today's sales by media — same source as Today's Sales card above */}
      <div className="mb-2 mt-4 flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Today&apos;s sales — by media</h2>
          <p className="text-[11px] text-muted-foreground">Where today&apos;s revenue came from. All-time balances are in Money.</p>
        </div>
        <button onClick={() => go("MONEY")} className="shrink-0 text-xs font-medium text-primary">Open Money →</button>
      </div>
      <div className="mb-5 space-y-2.5">
        <AccountTreeCard method="CASH" label="Cash" tree={data.tree.CASH} currency={cur} tone="emerald" defaultOpen />
        <AccountTreeCard method="MOBILE" label="Mobile Money" tree={data.tree.MOBILE} currency={cur} tone="sky" defaultOpen />
        <AccountTreeCard method="BANK" label="Bank" tree={data.tree.BANK} currency={cur} tone="violet" defaultOpen />
      </div>

      {/* Cash session */}
      {data.openSession && (
        <Card className="mb-4 overflow-hidden card-raised">
          <div className="flex items-center justify-between bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2" /><circle cx="12" cy="13" r="2.5" /></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Open Money / Cash Flow</p>
                  <Pill tone="good"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> drawer open</Pill>
                </div>
                <p className="text-[11px] text-muted-foreground">Opening {formatBirr(data.openSession.opening, cur)} · since {formatTime(data.openSession.openedAt)}</p>
              </div>
            </div>
            <button onClick={() => go("CASH_CONTROL")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground tap-scale">Close</button>
          </div>
        </Card>
      )}

      {/* Empty state or last sale */}
      {today.salesCount === 0 ? (
        <Card className="mb-4 flex flex-col items-center justify-center p-8 text-center card-raised">
          <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>
          </div>
          <p className="text-sm font-semibold">No sales yet today</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Your first sale of the day will appear here. Tap Sell to begin.</p>
          <button onClick={() => go("SELL")} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground meat-glow tap-scale">Start Selling</button>
        </Card>
      ) : (
        <Card className="mb-4 flex items-center justify-between p-4 card-raised">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Last sale</p>
            <p className="text-sm font-semibold">#{String(data.lastSaleNumber).padStart(6, "0")}</p>
          </div>
          <button onClick={() => go("SALES_HISTORY")} className="text-xs font-medium text-primary">View all →</button>
        </Card>
      )}

      <div className="px-1 pb-2 text-center text-[10px] text-muted-foreground">
        MeatBook · Charcoal + Meat Red · Offline-first
      </div>
      <div className="px-1 text-center text-[10px] text-muted-foreground/70">{data.settings.shopName}</div>
    </div>
  );
}

function QuickAction({ label, icon, onClick, tone }: { label: string; icon: React.ReactNode; onClick: () => void; tone?: "primary" }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 p-3 tap-scale ${tone === "primary" ? "bg-primary text-primary-foreground meat-glow" : "bg-card/60 hover:bg-card"}`}>
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Stock & Money Flow card — the owner's key business-health indicator.
// Answers: "Did today's sales cover today's purchases?" with color-coded
// profit meter: red (loss) → amber (break-even) → green (healthy).
// ════════════════════════════════════════════════════════════════════════
function StockFlowCard({ flow, cur }: { flow: DashboardData["flow"]; cur: string }) {
  const { profit, profitStatus, purchaseAmount, todayRevenue, purchaseKg, todayKgSold, todayExpenses, purchaseCoverage, kgRatio } = flow;

  // color theme by profit status
  const statusConfig = {
    loss: {
      ring: "ring-red-500/30",
      bg: "from-red-500/10 to-card",
      text: "text-red-400",
      label: "Loss today",
      bar: "bg-red-500",
      pill: "bg-red-500/15 text-red-400 ring-red-500/25",
    },
    break_even: {
      ring: "ring-amber-500/30",
      bg: "from-amber-500/10 to-card",
      text: "text-amber-400",
      label: "Break-even",
      bar: "bg-amber-500",
      pill: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
    },
    healthy: {
      ring: "ring-emerald-500/30",
      bg: "from-emerald-500/10 to-card",
      text: "text-emerald-400",
      label: "Healthy profit",
      bar: "bg-emerald-500",
      pill: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
    },
  }[profitStatus];

  // Coverage bar: how much of purchases were covered by sales (0% → 100%+)
  const coveragePct = Math.max(0, Math.min(100, purchaseCoverage * 100));

  // KG flow bar: sold vs purchased
  const kgMax = Math.max(purchaseKg, todayKgSold, 0.01);
  const soldPct = (todayKgSold / kgMax) * 100;
  const boughtPct = (purchaseKg / kgMax) * 100;

  return (
    <Card className={`mb-4 overflow-hidden bg-gradient-to-br ${statusConfig.bg} p-4 ring-1 ${statusConfig.ring} card-raised`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight">Stock &amp; Money Flow</h2>
          <p className="text-[11px] text-muted-foreground">Did today&apos;s sales cover today&apos;s purchases?</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusConfig.pill}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Profit hero number */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realized profit today</p>
          <p className={`text-2xl font-bold tnum ${statusConfig.text}`}>{formatBirr(profit, cur)}</p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <p>{formatBirr(todayRevenue, cur)} sales</p>
          <p>− {formatBirr(purchaseAmount, cur)} purchases</p>
          <p>− {formatBirr(todayExpenses, cur)} expenses</p>
        </div>
      </div>

      {/* Coverage bar: sales vs purchases */}
      {purchaseAmount > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Sales covering purchases</span>
            <span className={`font-bold tnum ${purchaseCoverage >= 1 ? "text-emerald-400" : "text-amber-400"}`}>
              {purchaseCoverage.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted/60">
            <div
              className={`h-full rounded-full ${purchaseCoverage >= 1 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${coveragePct}%` }}
            />
            {/* break-even marker at 100% */}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/40" />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {purchaseCoverage >= 1
              ? `Surplus: ${formatBirr(todayRevenue - purchaseAmount, cur)} beyond animal cost`
              : `Short by ${formatBirr(purchaseAmount - todayRevenue, cur)} to cover animals`}
          </p>
        </div>
      )}

      {/* KG flow: sold vs bought */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-background/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Sold today</p>
          <p className="mt-0.5 text-base font-bold tnum">{formatKg(todayKgSold)}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${soldPct}%` }} />
          </div>
        </div>
        <div className="rounded-xl bg-background/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Bought today</p>
          <p className="mt-0.5 text-base font-bold tnum">{formatKg(purchaseKg)}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${boughtPct}%` }} />
          </div>
        </div>
      </div>

      {purchaseKg > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          KG ratio: <span className={`font-semibold tnum ${kgRatio >= 1 ? "text-emerald-400" : kgRatio > 0 ? "text-amber-400" : "text-red-400"}`}>{(kgRatio * 100).toFixed(0)}%</span>
          {" "}of bought weight sold today
          {kgRatio < 1 && purchaseKg > 0 ? ` · ${formatKg(purchaseKg - todayKgSold)} in stock` : ""}
        </p>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Today's Purchases card — animal-type breakdown (Ox/Sheep/Goat)
// ════════════════════════════════════════════════════════════════════════
function TodayPurchasesCard({ purchases, cur, onOpen }: {
  purchases: DashboardData["todayPurchases"];
  cur: string;
  onOpen: () => void;
}) {
  return (
    <Card className="mb-4 overflow-hidden card-raised">
      <div className="flex items-center justify-between border-b border-border/60 bg-amber-500/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">↓</span>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Today&apos;s Purchases</h2>
            <p className="text-[11px] text-muted-foreground">{purchases.count} purchase{purchases.count > 1 ? "s" : ""} · {formatKg(purchases.totalKg)} · {formatBirr(purchases.total, cur)}</p>
          </div>
        </div>
        <button onClick={onOpen} className="text-[11px] font-medium text-primary">View →</button>
      </div>
      <div className="divide-y divide-border/40">
        {purchases.animalBreakdown.map((a) => (
          <div key={a.type} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg ring-1 ${animalTone(a.type)}`}>
              {animalEmoji(a.type)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{animalName(a.type)}{a.count > 1 ? ` ×${a.count}` : ""}</p>
              <p className="text-[11px] text-muted-foreground tnum">
                {formatKg(a.kg)} · {formatBirr(a.perKg, cur)}/kg cost
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold tnum text-amber-400">−{formatBirr(a.amount, cur)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}
      </div>
      <div className="mb-4 h-40 animate-pulse rounded-2xl bg-muted/50" />
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}
      </div>
    </div>
  );
}
