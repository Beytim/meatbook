"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { formatBirr, formatKg, formatTime, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/app/primitives";
import { AccountTreeCard, type AccountTree } from "@/components/app/account-tree";
import { animalName, animalEmoji, animalTone } from "@/lib/animals";
import { useLang } from "@/components/lang-provider";

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
  openSession: { id: string; opening: number; openedAt: string; openedBy: string | null; expectedCash?: number } | null;
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
  topProducts: { name: string; revenue: number; kg: number; count: number }[];
  recentSales: { number: string; type: string; total: number; totalKg: number; paymentMethod: string; paymentDetail: string | null; cashierName: string | null; itemCount: number; createdAt: string }[];
  debtsOutstanding: number;
  supplierBalance: number;
  avgSale: number;
  yesterdayRevenue: number;
  yesterdayCount: number;
  revenueChange: number;
  monthRevenue: number;
  weekRevenue: number;
  weekCount: number;
  methodSplit: { method: string; revenue: number; pct: number }[];
  wastageTodayKg: number;
  wastageTodayCount: number;
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/meat/dashboard");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function HomeView() {
  const go = useNav((s) => s.go);
  const { t } = useLang();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) return <div className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;

  const cur = data.settings.currency;
  const today = data.today;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-4 gap-2.5">
        <QuickAction label={t("qa.sell")} tone="primary" onClick={() => go("SELL")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>
        } />
        <QuickAction label={t("qa.expense")} onClick={() => go("EXPENSES")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h20v12H2z M2 11h20" /></svg>
        } />
        <QuickAction label={t("qa.purchase")} onClick={() => go("PURCHASES")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18 M7 10l3 3 4-5" /></svg>
        } />
        <QuickAction label={t("qa.waste")} onClick={() => go("WASTAGE")} icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 5a3.5 3.5 0 0 1 0 5l-5 5a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0z M9 9l6 6" /></svg>
        } />
      </div>

      {/* ─── Today's Sales — clean hero card ─── */}
      <Card className="mb-3 overflow-hidden card-raised bg-card">
        <div className="bg-gradient-to-br from-primary/12 via-card to-card px-4 py-3.5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("home.todaysSales")}</p>
              <p className="mt-0.5 text-2xl font-bold tnum tracking-tight">{formatBirr(today.revenue, cur)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground tnum">{today.salesCount} {today.salesCount === 1 ? t("home.sales") : t("salesHistory.salesPlural")}</p>
              <p className="text-xs text-muted-foreground tnum">{formatKg(today.kgSold)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.takeHome")}</p>
            </div>
            <p className="mt-1 text-base font-bold tnum">{formatBirr(today.takeHome.revenue, cur)}</p>
            <p className="text-[11px] text-muted-foreground tnum">{today.takeHome.count} {t("salesHistory.sales").toLowerCase()} · {formatKg(today.takeHome.kg)}</p>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.eatHere")}</p>
            </div>
            <p className="mt-1 text-base font-bold tnum">{formatBirr(today.eatHere.revenue, cur)}</p>
            <p className="text-[11px] text-muted-foreground tnum">{today.eatHere.count} {t("salesHistory.sales").toLowerCase()} · {formatKg(today.eatHere.kg)}</p>
          </div>
        </div>
      </Card>

      {/* ─── Quick Stats Row (world-standard metrics) ─── */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        <Card className="card-raised bg-card p-2 text-center">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.avgSale")}</p>
          <p className="mt-0.5 text-xs font-bold tnum">{formatBirr(data.avgSale, cur)}</p>
        </Card>
        <Card className="card-raised bg-card p-2 text-center">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.vsYesterday")}</p>
          <p className={cn("mt-0.5 text-xs font-bold tnum", data.revenueChange > 0 ? "text-emerald-400" : data.revenueChange < 0 ? "text-red-400" : "text-muted-foreground")}>
            {data.revenueChange > 0 ? "↑" : data.revenueChange < 0 ? "↓" : "—"} {Math.abs(data.revenueChange)}%
          </p>
        </Card>
        <Card className="card-raised bg-card p-2 text-center">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.week")}</p>
          <p className="mt-0.5 text-xs font-bold tnum">{formatBirr(data.weekRevenue, cur)}</p>
        </Card>
        <Card className="card-raised bg-card p-2 text-center">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.month")}</p>
          <p className="mt-0.5 text-xs font-bold tnum">{formatBirr(data.monthRevenue, cur)}</p>
        </Card>
      </div>

      {/* ─── Recovery — full width, clear labels ─── */}
      <div className="mb-3">
        <PurchaseRecoveryCard sales={data.flow.todayRevenue} purchaseCost={data.flow.purchaseAmount} cur={cur} t={t} />
      </div>

      {/* ─── Net Result — full width, clear labels ─── */}
      <div className="mb-3">
        <NetResultCard sales={data.flow.todayRevenue} purchaseCost={data.flow.purchaseAmount} expenses={data.flow.todayExpenses} cur={cur} t={t} />
      </div>

      {/* ─── Stock Flow — single unified card ─── */}
      <StockFlowCard
        kgSold={data.flow.todayKgSold}
        kgBought={data.flow.purchaseKg}
        cur={cur}
        t={t}
      />

      {/* ─── Today's Purchases — animal-type breakdown ─── */}
      {data.todayPurchases.count > 0 && (
        <TodayPurchasesCard purchases={data.todayPurchases} cur={cur} onOpen={() => go("PURCHASES")} t={t} />
      )}

      {/* ─── Payment Split (compact % bar) ─── */}
      {data.methodSplit.length > 0 && data.today.revenue > 0 && (
        <Card className="mb-3 card-raised bg-card p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.paymentSplit")}</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/60">
            {data.methodSplit.map((m) => {
              const colors: Record<string, string> = { CASH: "bg-emerald-500", MOBILE: "bg-sky-500", BANK: "bg-violet-500", CREDIT: "bg-amber-500" };
              return m.pct > 0 ? <div key={m.method} className={cn("h-full", colors[m.method] || "bg-muted")} style={{ width: `${m.pct}%` }} /> : null;
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
            {data.methodSplit.map((m) => {
              const colors: Record<string, string> = { CASH: "bg-emerald-400", MOBILE: "bg-sky-400", BANK: "bg-violet-400", CREDIT: "bg-amber-400" };
              const labels: Record<string, string> = { CASH: t("sell.cash"), MOBILE: t("sell.mobile"), BANK: t("sell.bank"), CREDIT: t("sell.credit") };
              return (
                <span key={m.method} className="flex items-center gap-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", colors[m.method] || "bg-muted")} />
                  <span className="text-muted-foreground">{labels[m.method] || m.method}</span>
                  <span className="font-semibold tnum">{m.pct}%</span>
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── Payment Methods ─── */}
      <div className="mb-2 mt-4 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight">{t("home.paymentMethodsTitle")}</h2>
        <button onClick={() => go("MONEY")} className="shrink-0 text-xs font-medium text-primary">{t("nav.money")} →</button>
      </div>
      <div className="mb-4 space-y-2">
        <AccountTreeCard method="CASH" label={t("money.cash")} tree={data.tree.CASH} currency={cur} tone="emerald" defaultOpen />
        <AccountTreeCard method="MOBILE" label={t("money.mobileMoney")} tree={data.tree.MOBILE} currency={cur} tone="sky" defaultOpen />
        <AccountTreeCard method="BANK" label={t("money.bank")} tree={data.tree.BANK} currency={cur} tone="violet" defaultOpen />
      </div>

      {/* ─── Top Products Today ─── */}
      {data.topProducts.length > 0 && (
        <TopProductsCard products={data.topProducts} cur={cur} onViewAll={() => go("PRODUCT_SALES")} t={t} />
      )}

      {/* ─── Recent Activity ─── */}
      {data.recentSales.length > 0 && (
        <RecentActivityCard sales={data.recentSales} cur={cur} t={t} />
      )}

      {/* ─── Debts + Supplier Balance (cross-module) ─── */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="card-raised bg-card p-3" onClick={() => go("CUSTOMER_DEBTS")}>
          <button className="block w-full text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.customerDebts")}</p>
            <p className="mt-0.5 text-lg font-bold tnum leading-none text-amber-400">{formatBirr(data.debtsOutstanding, cur)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{t("home.outstanding")} →</p>
          </button>
        </Card>
        <Card className="card-raised bg-card p-3" onClick={() => go("SUPPLIER_LEDGER")}>
          <button className="block w-full text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.supplierBalance")}</p>
            <p className="mt-0.5 text-lg font-bold tnum leading-none text-red-400">{formatBirr(data.supplierBalance, cur)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{t("home.weOwe")} →</p>
          </button>
        </Card>
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
                  <p className="text-sm font-semibold">{t("home.cashDrawer")}</p>
                  <Pill tone="good"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("common.open")}</Pill>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("home.expected")} <span className="font-semibold tnum text-foreground">{formatBirr(data.openSession.expectedCash ?? data.openSession.opening, cur)}</span>
                  {" · "}{t("home.opened")} {formatBirr(data.openSession.opening, cur)} · {formatTime(data.openSession.openedAt)}
                </p>
              </div>
            </div>
            <button onClick={() => go("CASH_CONTROL")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground tap-scale">{t("home.close")}</button>
          </div>
        </Card>
      )}

      {/* Empty state when no sales today */}
      {today.salesCount === 0 && (
        <Card className="mb-4 flex flex-col items-center justify-center p-8 text-center card-raised">
          <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>
          </div>
          <p className="text-sm font-semibold">{t("home.noSalesToday")}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t("home.firstSaleToday")}</p>
          <button onClick={() => go("SELL")} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground meat-glow tap-scale">{t("home.startSelling")}</button>
        </Card>
      )}

      <div className="px-1 pb-2 text-center text-[10px] text-muted-foreground">
        {t("home.meatbookFooter")}
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
// PURCHASE RECOVERY — full width, clear context
// ════════════════════════════════════════════════════════════════════════
function PurchaseRecoveryCard({ sales, purchaseCost, cur, t }: { sales: number; purchaseCost: number; cur: string; t: (k: string) => string }) {
  if (purchaseCost <= 0) {
    return (
      <Card className="card-raised bg-card p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.purchaseRecovery")}</p>
        <p className="mt-1.5 text-xl font-bold tnum text-muted-foreground">—</p>
        <p className="text-[11px] text-muted-foreground">{t("home.noPurchasesToday")}</p>
      </Card>
    );
  }
  const pct = (sales / purchaseCost) * 100;
  const diff = sales - purchaseCost;
  const isBreakEven = Math.abs(diff) < 0.005;
  const isAbove = diff > 0;
  const color = isBreakEven ? "#2563EB" : isAbove ? "#16803C" : "#C53030";
  return (
    <Card className="card-raised bg-card p-3.5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.purchaseRecovery")}</p>
          <p className="mt-0.5 text-xl font-bold tnum leading-none" style={{ color }}>{pct.toFixed(1)}%</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("home.ofPurchaseCostRecovered")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground tnum">{formatBirr(sales, cur)} in</p>
          <p className="text-[11px] text-muted-foreground tnum">{formatBirr(purchaseCost, cur)} spent</p>
        </div>
      </div>
      <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-muted/60">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pct / 200) * 100)}%`, backgroundColor: color }} />
        <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/40" />
      </div>
      <p className="mt-2 text-[11px] font-medium" style={{ color }}>
        {isBreakEven
          ? t("home.costRecovered")
          : isAbove
          ? `+${formatBirr(diff, cur)} ${t("home.abovePurchaseCost")}`
          : `−${formatBirr(Math.abs(diff), cur)} ${t("home.stillNeeded")}`}
      </p>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// NET RESULT — full width, clear context
// ════════════════════════════════════════════════════════════════════════
function NetResultCard({ sales, purchaseCost, expenses, cur, t }: { sales: number; purchaseCost: number; expenses: number; cur: string; t: (k: string) => string }) {
  const net = Math.round((sales - purchaseCost - expenses) * 100) / 100;
  const isZero = Math.abs(net) < 0.005;
  const isPositive = net > 0;
  const color = isZero ? "#2563EB" : isPositive ? "#16803C" : "#C53030";
  const label = isZero ? t("home.breakEvenLabel") : isPositive ? t("home.profit") : t("home.loss");
  return (
    <Card className="card-raised bg-card p-3.5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.netResult")}</p>
          <p className="mt-0.5 text-xl font-bold tnum leading-none" style={{ color }}>
            {net < 0 ? "−" : isPositive ? "+" : ""}{formatBirr(Math.abs(net), cur)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium" style={{ color }}>{label} {t("home.todayLabel")}</p>
        </div>
        <div className="text-right space-y-0.5 text-[11px] tnum text-muted-foreground">
          <p>+ {formatBirr(sales, cur)} <span className="text-muted-foreground/60">{t("home.sales")}</span></p>
          <p>− {formatBirr(purchaseCost, cur)} <span className="text-muted-foreground/60">{t("home.purchase")}</span></p>
          <p>− {formatBirr(expenses, cur)} <span className="text-muted-foreground/60">{t("home.expenses")}</span></p>
        </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// STOCK FLOW — single unified card: Bought → Sold → Remaining
// No duplicate numbers. One clear picture of today's meat flow.
// ════════════════════════════════════════════════════════════════════════
function StockFlowCard({ kgSold, kgBought, cur: _cur, t }: { kgSold: number; kgBought: number; cur: string; t: (k: string) => string }) {
  const remaining = Math.max(0, Math.round((kgBought - kgSold) * 100) / 100);
  const soldPct = kgBought > 0 ? Math.round((kgSold / kgBought) * 100) : 0;
  const barColor = soldPct >= 50 ? "bg-emerald-500" : soldPct > 0 ? "bg-amber-500" : "bg-muted-foreground/40";

  return (
    <Card className="mb-3 card-raised bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.stockFlow")}</p>
        <span className="text-[10px] font-bold tnum text-muted-foreground">{soldPct}% {t("home.soldToday2").toLowerCase()}</span>
      </div>
      {/* Three-column flow: Bought → Sold → Left */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-amber-500/8 px-2 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-400">{t("home.bought")}</p>
          <p className="mt-0.5 text-sm font-bold tnum">{formatKg(kgBought)}</p>
        </div>
        <div className="rounded-lg bg-emerald-500/8 px-2 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-400">{t("home.soldToday2")}</p>
          <p className="mt-0.5 text-sm font-bold tnum">{formatKg(kgSold)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.leftLabel")}</p>
          <p className="mt-0.5 text-sm font-bold tnum">{formatKg(remaining)}</p>
        </div>
      </div>
      {/* Single progress bar — sold portion of bought */}
      {kgBought > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, soldPct)}%` }} />
        </div>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Today's Purchases card — animal-type breakdown (Ox/Sheep/Goat)
// ════════════════════════════════════════════════════════════════════════
function TodayPurchasesCard({ purchases, cur, onOpen, t }: {
  purchases: DashboardData["todayPurchases"];
  cur: string;
  onOpen: () => void;
  t: (k: string) => string;
}) {
  return (
    <Card className="mb-4 overflow-hidden card-raised">
      <div className="flex items-center justify-between border-b border-border/60 bg-amber-500/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">↓</span>
          <div>
            <h2 className="text-sm font-bold tracking-tight">{t("home.todaysPurchases")}</h2>
            <p className="text-[11px] text-muted-foreground">{purchases.count} {purchases.count > 1 ? t("home.purchases").toLowerCase() : t("home.purchase")} · {formatKg(purchases.totalKg)} · {formatBirr(purchases.total, cur)}</p>
          </div>
        </div>
        <button onClick={onOpen} className="text-[11px] font-medium text-primary">{t("common.view")} →</button>
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
                {formatKg(a.kg)} · {formatBirr(a.perKg, cur)}/{t("purchases.weight").replace(" (kg)", "")}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold tnum text-amber-400">−{formatBirr(a.amount, cur)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TOP PRODUCTS — which meats are driving today's revenue
// ════════════════════════════════════════════════════════════════════════
function TopProductsCard({ products, cur, onViewAll, t }: { products: DashboardData["topProducts"]; cur: string; onViewAll: () => void; t: (k: string) => string }) {
  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);
  return (
    <Card className="mb-3 card-raised bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.topProducts")}</p>
        <button onClick={onViewAll} className="text-[10px] font-medium text-primary">{t("common.viewAll")} →</button>
      </div>
      <div className="space-y-2">
        {products.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2.5">
            <span className="w-4 text-right text-[11px] font-bold tnum text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs font-semibold">{p.name}</p>
                <p className="shrink-0 text-xs font-bold tnum">{formatBirr(p.revenue, cur)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground tnum">{p.count}× · {formatKg(p.kg)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════
// RECENT ACTIVITY — last 5 sales today
// ════════════════════════════════════════════════════════════════════════
function RecentActivityCard({ sales, cur, t }: { sales: DashboardData["recentSales"]; cur: string; t: (k: string) => string }) {
  return (
    <Card className="mb-3 card-raised bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("home.recentActivity")}</p>
        <button onClick={() => useNav.getState().go("SALES_HISTORY")} className="text-[10px] font-medium text-primary">{t("common.all")} →</button>
      </div>
      <div className="space-y-1.5">
        {sales.map((s) => (
          <div key={s.number} className="flex items-center gap-2.5 rounded-lg bg-muted/20 px-2.5 py-2">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.type === "TAKE_HOME" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              <span className="text-[9px] font-bold">{s.type === "TAKE_HOME" ? "OUT" : "IN"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tnum">#{s.number}</p>
              <p className="text-[10px] text-muted-foreground">
                {s.itemCount} {s.itemCount > 1 ? t("common.items") : t("common.item")} · {formatKg(s.totalKg)} · {s.cashierName || "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold tnum text-emerald-400">+{formatBirr(s.total, cur)}</p>
              <p className="text-[10px] text-muted-foreground">
                {s.paymentMethod === "CASH" ? t("sell.cash") : s.paymentMethod === "MOBILE" ? t("sell.mobile") : t("sell.bank")}
              </p>
            </div>
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
