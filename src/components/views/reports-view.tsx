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
  paymentMethods: { method: string; revenue: number; share: number }[];
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
  const [period, setPeriod] = React.useState<PeriodKey>("30D");
  const [cat, setCat] = React.useState<Category>("Sales");
  const { data, isLoading } = useQuery<ReportsData>({
    queryKey: ["reports", period],
    queryFn: () => fetchReports(period),
  });

  return (
    <PageScaffold
      title="Reports"
      subtitle={`Period: ${periodLabel(period)}`}
      onBack={() => back()}
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR"]}
        />
      </div>

      {/* Category tabs (horizontal scroll) */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tap-scale",
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !data ? (
        <EmptyState
          title="Could not load reports."
          description="Try again later."
        />
      ) : (
        <>
          {cat === "Sales" && <SalesReport data={data} />}
          {cat === "Products" && <ProductsReport data={data} />}
          {cat === "Money" && <MoneyReport data={data} />}
          {cat === "Purchases" && <SimpleTotalReport tone="sky" label="Total Purchases" value={data.purchases} caption="Cost of meat bought from suppliers in this period." sub="Logged in Purchases view." />}
          {cat === "Expenses" && <SimpleTotalReport tone="amber" label="Total Expenses" value={data.expenses} caption="Operating expenses recorded in this period." sub="Logged in Expenses view." />}
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
  const total = data.split.takeHome.revenue + data.split.eatHere.revenue;
  const splitData = [
    { name: "Take Home", value: Math.round(data.split.takeHome.revenue * 100) / 100, color: AMBER },
    { name: "Eat Here", value: Math.round(data.split.eatHere.revenue * 100) / 100, color: EMERALD },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Net revenue hero */}
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Net Revenue
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight">
            {formatBirr(data.netRevenue)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sales Count
              </p>
              <p className="text-base font-bold tnum">{data.salesCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Kg Sold
              </p>
              <p className="text-base font-bold tnum">{formatKg(data.kgSold)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* OUT vs IN Revenue Split */}
      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">OUT vs IN Revenue Split</h3>
        {total === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No sales in this period.
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
                  Total
                </p>
                <p className="text-sm font-bold tnum">{formatBirr(total)}</p>
              </div>
              <SplitRow
                tone="amber"
                label="Take Home · OUT"
                split={data.split.takeHome}
              />
              <SplitRow
                tone="emerald"
                label="Eat Here · IN"
                split={data.split.eatHere}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Revenue by Payment Method */}
      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">Revenue by Payment Method</h3>
        {data.paymentMethods.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No sales in this period.
          </p>
        ) : (
          <div className="space-y-3">
            {data.paymentMethods.map((m) => (
              <PaymentMethodRow
                key={m.method}
                method={m.method}
                revenue={m.revenue}
                share={m.share}
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
}: {
  method: string;
  revenue: number;
  share: number;
}) {
  const m = (method || "").toUpperCase();
  const label = m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile Money" : m === "BANK" ? "Bank" : method;
  const tone = m === "CASH" ? "emerald" : m === "MOBILE" ? "sky" : "violet";
  const accent = { emerald: "bg-emerald-400", sky: "bg-sky-400", violet: "bg-violet-400" }[tone];
  const pct = Math.max(0, Math.min(100, share * 100));
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
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════════════
function ProductsReport({ data }: { data: ReportsData }) {
  const top = data.products.slice(0, 8);
  const max = Math.max(...top.map((p) => p.revenue), 1);
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top Products · Revenue
          </p>
          <p className="mt-1 text-2xl font-bold tnum tracking-tight">
            {formatBirr(data.products.reduce((a, b) => a + b.revenue, 0))}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.products.length}{" "}
            {data.products.length === 1 ? "product" : "products"} sold in this period
          </p>
        </div>
      </Card>

      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">Top Products by Revenue</h3>
        {top.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No products sold in this period.
          </p>
        ) : (
          <div className="space-y-3">
            {top.map((p, i) => (
              <div key={p.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-muted text-[10px] font-bold tnum">
                      {i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold tnum">{formatBirr(p.revenue)}</span>
                    <span className="ml-2 text-muted-foreground tnum">
                      {formatKg(p.kg)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(p.revenue / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MONEY
// ════════════════════════════════════════════════════════════════════════
function MoneyReport({ data }: { data: ReportsData }) {
  const moneyIn = data.netRevenue;
  const moneyOut = data.expenses + data.purchases;
  const net = moneyIn - moneyOut;
  const max = Math.max(moneyIn, moneyOut, 1);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Net Cash
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tnum tracking-tight",
              net >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatBirr(net)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">In − Out</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Money In
              </p>
            </div>
            <p className="mt-1 text-base font-bold tnum text-emerald-400">
              {formatBirr(moneyIn)}
            </p>
            <p className="text-[11px] text-muted-foreground">From sales</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Money Out
              </p>
            </div>
            <p className="mt-1 text-base font-bold tnum text-red-400">
              {formatBirr(moneyOut)}
            </p>
            <p className="text-[11px] text-muted-foreground">Expenses + Purchases</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">Money Sources &amp; Uses</h3>
        <div className="space-y-3">
          <BarRow label="Sales (In)" value={data.netRevenue} max={max} tone="emerald" />
          <BarRow label="Expenses (Out)" value={data.expenses} max={max} tone="red" />
          <BarRow label="Purchases (Out)" value={data.purchases} max={max} tone="red" />
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
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-red-500/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Waste
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight text-red-400">
            {formatKg(data.wastageKg)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Meat discarded in this period
          </p>
        </div>
        <div className="p-4 text-xs text-muted-foreground">
          Logged in Wastage view. Trim losses, spoilage, and refused cuts go here.
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PROFIT
// ════════════════════════════════════════════════════════════════════════
function ProfitReport({ data }: { data: ReportsData }) {
  const profit = data.profit;
  const margin = data.netRevenue > 0 ? (profit / data.netRevenue) * 100 : 0;
  const chartData = [
    { name: "Revenue", value: Math.round(data.netRevenue * 100) / 100, color: MEAT_RED },
    { name: "Purchases", value: Math.round(data.purchases * 100) / 100, color: SKY },
    { name: "Expenses", value: Math.round(data.expenses * 100) / 100, color: AMBER },
    {
      name: "Profit",
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
            Net Profit
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
            Revenue − Purchases − Expenses
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Pill tone={profit >= 0 ? "good" : "bad"}>
              {margin.toFixed(1)}% margin
            </Pill>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60">
          <ProfitCell label="Revenue" value={data.netRevenue} tone="default" />
          <ProfitCell label="Purchases" value={-data.purchases} tone="bad" />
          <ProfitCell label="Expenses" value={-data.expenses} tone="bad" />
        </div>
      </Card>

      <Card className="p-4 card-raised">
        <h3 className="mb-3 text-sm font-semibold">Profit Breakdown</h3>
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
