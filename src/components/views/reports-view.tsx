"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  formatBirr, formatKg, cn,
  type PeriodKey, periodLabel,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import {
  PeriodTabs, EmptyState, Pill, PageScaffold, ListSkeleton, Money,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface Split {
  revenue: number;
  count: number;
  kg: number;
}

interface ReportsData {
  period: string;
  netRevenue: number;
  salesCount: number;
  kgSold: number;
  split: { takeHome: Split; eatHere: Split };
  paymentMethods: { method: string; revenue: number; share: number; subAccounts: { detail: string | null; revenue: number }[] }[];
  products: { name: string; revenue: number; kg: number; count: number }[];
  expenses: number;
  purchases: number;
  wastageKg: number;
  profit: number;
}

const CATEGORIES = [
  "Sales", "Products", "Money", "Purchases", "Expenses", "Waste", "Profit",
] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_KEYS: Record<Category, string> = {
  Sales: "reports.sales",
  Products: "reports.products",
  Money: "reports.money",
  Purchases: "reports.purchases",
  Expenses: "reports.expenses",
  Waste: "reports.waste",
  Profit: "reports.profit",
};

// Chart palette
const MEAT_RED = "#e0533f";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const SKY = "#0ea5e9";
const VIOLET = "#a78bfa";
const RED_BAD = "#ef4444";

async function fetchReports(period: PeriodKey): Promise<ReportsData> {
  const r = await fetch(`/api/meat/reports?period=${period}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

const TOOLTIP_STYLE = {
  background: "oklch(0.2 0 0 / 0.95)",
  border: "1px solid oklch(0.3 0 0)",
  borderRadius: 12,
  fontSize: 12,
};

// ─── View ───────────────────────────────────────────────────────────────
export function ReportsView() {
  const { back } = useNav();
  const { t } = useLang();
  const [period, setPeriod] = React.useState<PeriodKey>("30D");
  const [cat, setCat] = React.useState<Category>("Sales");
  const { data, isLoading } = useQuery<ReportsData>({
    queryKey: ["reports", period],
    queryFn: () => fetchReports(period),
  });

  return (
    <PageScaffold
      title={t("reports.title")}
      subtitle={`${t("common.from")} ${periodLabel(period)}`}
      onBack={() => back()}
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR"]}
        />
      </div>

      {/* Category tabs (horizontal scroll) — compact */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tap-scale",
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              {t(CATEGORY_KEYS[c])}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !data ? (
        <EmptyState
          title={t("common.loading")}
          description={t("common.loading")}
        />
      ) : (
        <>
          {cat === "Sales" && <SalesReport data={data} />}
          {cat === "Products" && <ProductsReport data={data} />}
          {cat === "Money" && <MoneyReport data={data} />}
          {cat === "Purchases" && <SimpleTotalReport tone="sky" label={t("reports.purchases")} value={data.purchases} caption={t("purchases.subtitle")} sub={t("purchases.title")} />}
          {cat === "Expenses" && <SimpleTotalReport tone="amber" label={t("reports.expenses")} value={data.expenses} caption={t("expenses.subtitle")} sub={t("expenses.title")} />}
          {cat === "Waste" && <WasteReport data={data} />}
          {cat === "Profit" && <ProfitReport data={data} />}
        </>
      )}
    </PageScaffold>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SALES
// ════════════════════════════════════════════════════════════════════════
function SalesReport({ data }: { data: ReportsData }) {
  const { t } = useLang();
  const total = data.split.takeHome.revenue + data.split.eatHere.revenue;
  const splitData = [
    { name: t("sell.takeHome"), value: Math.round(data.split.takeHome.revenue * 100) / 100, color: AMBER },
    { name: t("sell.eatHere"), value: Math.round(data.split.eatHere.revenue * 100) / 100, color: EMERALD },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Net revenue hero */}
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("reports.netRevenue")}
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight">
            {formatBirr(data.netRevenue)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("reports.salesCount")}
              </p>
              <p className="text-base font-bold tnum">{data.salesCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("reports.kgSold")}
              </p>
              <p className="text-base font-bold tnum">{formatKg(data.kgSold)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* OUT vs IN Revenue Split */}
      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">{t("reports.byProduct")}</h3>
        {total === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t("salesHistory.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={splitData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={2}
                  >
                    {splitData.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatBirr(v)}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("common.total")}
                </p>
                <p className="text-sm font-bold tnum">{formatBirr(total)}</p>
              </div>
              <SplitRow
                tone="amber"
                label={`${t("sell.takeHome")} · OUT`}
                split={data.split.takeHome}
              />
              <SplitRow
                tone="emerald"
                label={`${t("sell.eatHere")} · IN`}
                split={data.split.eatHere}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Revenue by Payment Method */}
      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">{t("reports.byMethod")}</h3>
        {data.paymentMethods.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t("salesHistory.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {data.paymentMethods.map((m) => (
              <PaymentMethodRow
                key={m.method}
                method={m.method}
                revenue={m.revenue}
                share={m.share}
                subAccounts={m.subAccounts}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SplitRow({
  tone,
  label,
  split,
}: {
  tone: "amber" | "emerald";
  label: string;
  split: Split;
}) {
  const dotCls = tone === "amber" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", dotCls)} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-right">
        <p className="font-bold tnum">{formatBirr(split.revenue)}</p>
        <p className="text-[10px] text-muted-foreground tnum">
          {split.count} sales · {formatKg(split.kg)}
        </p>
      </div>
    </div>
  );
}

function PaymentMethodRow({
  method,
  revenue,
  share,
  subAccounts,
}: {
  method: string;
  revenue: number;
  share: number;
  subAccounts?: { detail: string | null; revenue: number }[];
}) {
  const m = (method || "").toUpperCase();
  const label = m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile Money" : m === "BANK" ? "Bank" : method;
  const tone = m === "CASH" ? "emerald" : m === "MOBILE" ? "sky" : "violet";
  const accent = { emerald: "bg-emerald-400", sky: "bg-sky-400", violet: "bg-violet-400" }[tone];
  const pct = Math.max(0, Math.min(100, share * 100));
  const hasSubs = !!subAccounts && subAccounts.length > 0 && m !== "CASH";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", accent)} />
          <span className="font-medium">{label}</span>
        </div>
        <div className="text-right">
          <span className="font-bold tnum">{formatBirr(revenue)}</span>
          <span className="ml-2 text-muted-foreground tnum">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn("h-full rounded-full", accent)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hasSubs && (
        <div className="mt-2 space-y-1 pl-4">
          {subAccounts!.map((s, i) => (
            <div key={(s.detail ?? "") + i} className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                {s.detail ? s.detail : "Unspecified"}
              </span>
              <span className="font-semibold tnum">{formatBirr(s.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════════════
// ─── Products Report (enhanced with Take Home/Eat Here breakdown) ──────
// Fetches sales data client-side (same as old Product Sales view) and
// aggregates per product with type sub-breakdowns.
interface ProductAgg {
  name: string;
  revenue: number;
  kg: number;
  sales: number;
  avgPricePerKg: number;
  takeHome: { revenue: number; count: number; kg: number };
  eatHere: { revenue: number; count: number; kg: number };
}

function ProductsReport({ data }: { data: ReportsData }) {
  const { t } = useLang();
  const [typeFilter, setTypeFilter] = React.useState<"ALL" | "TAKE_HOME" | "EAT_HERE">("ALL");
  const [searchQ, setSearchQ] = React.useState("");

  // Fetch sales for this period (client-side aggregation, same as old Product Sales view)
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["sales", "PRODUCTS_REPORT", data.period],
    queryFn: async () => {
      const r = await fetch(`/api/meat/sales?period=${data.period}`);
      if (!r.ok) throw new Error("failed");
      return r.json() as Promise<{ sales: { status: string; type: string; items: { name: string; total: number; kg: number }[] }[] }>;
    },
  });

  // Aggregate per product
  const products = React.useMemo<ProductAgg[]>(() => {
    const map = new Map<string, ProductAgg>();
    for (const s of salesData?.sales ?? []) {
      if (s.status !== "COMPLETED") continue;
      if (typeFilter !== "ALL" && s.type !== typeFilter) continue;
      const isTH = s.type === "TAKE_HOME";
      for (const it of s.items) {
        let cur = map.get(it.name);
        if (!cur) {
          cur = { name: it.name, revenue: 0, kg: 0, sales: 0, avgPricePerKg: 0,
            takeHome: { revenue: 0, count: 0, kg: 0 }, eatHere: { revenue: 0, count: 0, kg: 0 } };
          map.set(it.name, cur);
        }
        cur.revenue += it.total;
        cur.kg += it.kg;
        cur.sales += 1;
        if (isTH) { cur.takeHome.revenue += it.total; cur.takeHome.kg += it.kg; cur.takeHome.count += 1; }
        else { cur.eatHere.revenue += it.total; cur.eatHere.kg += it.kg; cur.eatHere.count += 1; }
      }
    }
    const arr = Array.from(map.values());
    for (const p of arr) p.avgPricePerKg = p.kg > 0 ? Math.round((p.revenue / p.kg) * 100) / 100 : 0;
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr;
  }, [salesData, typeFilter]);

  const filtered = searchQ
    ? products.filter((p) => p.name.toLowerCase().includes(searchQ.toLowerCase()))
    : products;

  const periodRevenue = products.reduce((a, b) => a + b.revenue, 0);
  const periodKg = products.reduce((a, b) => a + b.kg, 0);

  // Chart data (top 6)
  const chartData = products.slice(0, 6).map((p) => ({ name: p.name, revenue: p.revenue }));
  const MEAT_RED = "#e0533f";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("productSales.topProducts")}
          </p>
          <p className="mt-1 text-2xl font-bold tnum tracking-tight">
            {formatBirr(periodRevenue)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tnum">
            {products.reduce((a, b) => a + b.sales, 0)} {t("salesHistory.salesPlural")} · {formatKg(periodKg)} {t("productSales.kgSold")} · {products.length} {t("reports.products").toLowerCase()}
          </p>
        </div>
      </Card>

      {/* Type filter */}
      <div className="grid grid-cols-3 gap-1.5">
        {(["ALL", "TAKE_HOME", "EAT_HERE"] as const).map((tf) => {
          const active = typeFilter === tf;
          return (
            <button key={tf} onClick={() => setTypeFilter(tf)}
              className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", active && tf === "ALL" && "bg-primary text-primary-foreground", active && tf === "TAKE_HOME" && "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30", active && tf === "EAT_HERE" && "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30", !active && "bg-muted/60 text-muted-foreground")}>
              {tf === "ALL" ? t("common.all") : tf === "TAKE_HOME" ? t("home.takeHome") : t("home.eatHere")}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder={t("productSales.searchPlaceholder")}
          className="h-9 w-full rounded-lg border border-border/60 bg-card/80 pl-9 pr-3 text-xs font-medium text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15" />
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card className="p-4 card-raised">
          <h3 className="mb-3 text-sm font-semibold">{t("productSales.topProducts")}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" stroke="oklch(0.68 0.008 55)" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.008 55)" tick={{ fontSize: 10 }} width={50} />
                <Tooltip formatter={(v: number) => formatBirr(v)} contentStyle={{ background: "oklch(0.2 0 0 / 0.95)", border: "1px solid oklch(0.3 0 0)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((_, i) => <Cell key={i} fill={MEAT_RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Product cards */}
      {salesLoading ? (
        <ListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("productSales.noProducts")} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <Card key={p.name} className="p-3.5 card-raised">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground tnum">
                    {p.sales} {p.sales === 1 ? t("home.sales") : t("salesHistory.salesPlural")} · {formatKg(p.kg)} · {t("productSales.avgPerKg")} {formatBirr(p.avgPricePerKg)}/kg
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tnum">{formatBirr(p.revenue)}</p>
              </div>
              {(p.takeHome.count > 0 || p.eatHere.count > 0) && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {p.takeHome.count > 0 && (
                    <div className="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/15">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">{t("home.takeHome")} · {t("common.out")}</p>
                      <p className="mt-0.5 text-sm font-bold tnum">{formatBirr(p.takeHome.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground tnum">{p.takeHome.count} {p.takeHome.count === 1 ? t("home.sales") : t("salesHistory.salesPlural")} · {formatKg(p.takeHome.kg)}</p>
                    </div>
                  )}
                  {p.eatHere.count > 0 && (
                    <div className="rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/15">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{t("home.eatHere")} · {t("common.in")}</p>
                      <p className="mt-0.5 text-sm font-bold tnum">{formatBirr(p.eatHere.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground tnum">{p.eatHere.count} {p.eatHere.count === 1 ? t("home.sales") : t("salesHistory.salesPlural")} · {formatKg(p.eatHere.kg)}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MONEY
// ════════════════════════════════════════════════════════════════════════
function MoneyReport({ data }: { data: ReportsData }) {
  const { t } = useLang();
  const moneyIn = data.netRevenue;
  const moneyOut = data.expenses + data.purchases;
  const net = moneyIn - moneyOut;
  const max = Math.max(moneyIn, moneyOut, 1);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("money.netFlow")}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tnum tracking-tight",
              net >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatBirr(net)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("money.moneyIn")} − {t("money.moneyOut")}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("money.moneyIn")}
              </p>
            </div>
            <p className="mt-1 text-base font-bold tnum text-emerald-400">
              {formatBirr(moneyIn)}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("reports.sales")}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("money.moneyOut")}
              </p>
            </div>
            <p className="mt-1 text-base font-bold tnum text-red-400">
              {formatBirr(moneyOut)}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("reports.expenses")} + {t("reports.purchases")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">{t("reports.money")}</h3>
        <div className="space-y-3">
          <BarRow label={`${t("reports.sales")} (${t("money.moneyIn")})`} value={data.netRevenue} max={max} tone="emerald" />
          <BarRow label={`${t("reports.expenses")} (${t("money.moneyOut")})`} value={data.expenses} max={max} tone="red" />
          <BarRow label={`${t("reports.purchases")} (${t("money.moneyOut")})`} value={data.purchases} max={max} tone="red" />
        </div>
      </Card>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "emerald" | "red";
}) {
  const bar = tone === "emerald" ? "bg-emerald-400" : "bg-red-400";
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-bold tnum">{formatBirr(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn("h-full rounded-full", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SIMPLE TOTAL (Purchases, Expenses)
// ════════════════════════════════════════════════════════════════════════
function SimpleTotalReport({
  tone,
  label,
  value,
  caption,
  sub,
}: {
  tone: "sky" | "amber";
  label: string;
  value: number;
  caption: string;
  sub: string;
}) {
  const grad =
    tone === "sky"
      ? "from-sky-500/15 via-card to-card"
      : "from-amber-500/15 via-card to-card";
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className={cn("bg-gradient-to-br p-5", grad)}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight">
            {formatBirr(value)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="p-4 text-xs text-muted-foreground">{sub}</div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// WASTE
// ════════════════════════════════════════════════════════════════════════
function WasteReport({ data }: { data: ReportsData }) {
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-red-500/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("wastage.totalWasted")}
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight text-red-400">
            {formatKg(data.wastageKg)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("wastage.subtitle")}
          </p>
        </div>
        <div className="p-4 text-xs text-muted-foreground">
          {t("wastage.subtitle")}
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PROFIT
// ════════════════════════════════════════════════════════════════════════
function ProfitReport({ data }: { data: ReportsData }) {
  const { t } = useLang();
  const profit = data.profit;
  const margin = data.netRevenue > 0 ? (profit / data.netRevenue) * 100 : 0;
  const chartData = [
    { name: t("reports.revenue"), value: Math.round(data.netRevenue * 100) / 100, color: MEAT_RED },
    { name: t("reports.purchases"), value: Math.round(data.purchases * 100) / 100, color: SKY },
    { name: t("reports.expenses"), value: Math.round(data.expenses * 100) / 100, color: AMBER },
    {
      name: t("reports.profit"),
      value: Math.round(profit * 100) / 100,
      color: profit >= 0 ? EMERALD : RED_BAD,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div
          className={cn(
            "bg-gradient-to-br p-5",
            profit >= 0
              ? "from-emerald-500/15 via-card to-card"
              : "from-red-500/15 via-card to-card",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("reports.netProfit")}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tnum tracking-tight",
              profit >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatBirr(profit)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("reports.revenue")} − {t("reports.purchases")} − {t("reports.expenses")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Pill tone={profit >= 0 ? "good" : "bad"}>
              {margin.toFixed(1)}% {t("reports.margin")}
            </Pill>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60">
          <ProfitCell label={t("reports.revenue")} value={data.netRevenue} tone="default" />
          <ProfitCell label={t("reports.purchases")} value={-data.purchases} tone="bad" />
          <ProfitCell label={t("reports.expenses")} value={-data.expenses} tone="bad" />
        </div>
      </Card>

      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">{t("reports.profit")}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                stroke="oklch(0.68 0.008 55)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="oklch(0.68 0.008 55)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number) => formatBirr(v)}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "oklch(0.62 0.22 25 / 0.12)" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ProfitCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "bad";
}) {
  return (
    <div className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-bold tnum",
          tone === "bad" ? "text-red-400" : "text-foreground",
        )}
      >
        {formatBirr(value)}
      </p>
    </div>
  );
}
