"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { formatBirr, formatKg, formatTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/app/primitives";

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

      {/* Money — where it is */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-base font-semibold tracking-tight">Money — where it is</h2>
        <button onClick={() => go("MONEY")} className="text-xs font-medium text-primary">Open Money →</button>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <AccountCard label="Cash" amount={data.accounts.cash} cur={cur} tone="emerald" />
        <AccountCard label="Mobile" amount={data.accounts.mobile} cur={cur} tone="sky" />
        <AccountCard label="Bank" amount={data.accounts.bank} cur={cur} tone="violet" />
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

function AccountCard({ label, amount, cur, tone }: { label: string; amount: number; cur: string; tone: "emerald" | "sky" | "violet" }) {
  const tones = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 ring-emerald-500/20",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-400 ring-sky-500/20",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-400 ring-violet-500/20",
  }[tone];
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br p-3 ring-1 ${tones}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 text-sm font-bold tnum tracking-tight">{formatBirr(amount, cur)}</p>
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
