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
} from "recharts";
import {
  PeriodTabs, SearchInput, EmptyState, StatTile, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
interface SaleItem { name: string; unitPrice: number; kg: number; total: number; }
type SaleType = "TAKE_HOME" | "EAT_HERE";
type SaleStatus = "COMPLETED" | "VOIDED" | "REFUNDED";

interface Sale {
  id: string;
  number: string;
  type: SaleType;
  paymentMethod: string;
  paymentDetail: string | null;
  total: number;
  totalKg: number;
  status: SaleStatus;
  cashierName: string;
  createdAt: string;
  items: SaleItem[];
}

interface SalesResp {
  sales: Sale[];
  stats: { revenue: number; kgSold: number; count: number };
}

type TypeFilter = "ALL" | "TAKE_HOME" | "EAT_HERE";

interface ProductAgg {
  name: string;
  revenue: number;
  kg: number;
  count: number;
  takeHome: { revenue: number; count: number; kg: number };
  eatHere: { revenue: number; count: number; kg: number };
}

// ─── Chart palette (meat-red family) ────────────────────────────────────
const BAR_COLORS = ["#e0533f", "#e87844", "#d4944a", "#b8722f", "#9c6a3a", "#7a5a40"];

async function fetchSales(period: PeriodKey): Promise<SalesResp> {
  const r = await fetch(`/api/meat/sales?period=${period}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function ProductSalesView() {
  const { back } = useNav();
  const [period, setPeriod] = React.useState<PeriodKey>("7D");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL");
  const [query, setQuery] = React.useState("");

  const { data, isLoading } = useQuery<SalesResp>({
    queryKey: ["sales", period],
    queryFn: () => fetchSales(period),
  });

  // Aggregate per product, respecting the type filter
  const products = React.useMemo<ProductAgg[]>(() => {
    const map = new Map<string, ProductAgg>();
    for (const s of data?.sales ?? []) {
      if (s.status !== "COMPLETED") continue;
      if (typeFilter !== "ALL" && s.type !== typeFilter) continue;
      const isTH = s.type === "TAKE_HOME";
      for (const it of s.items) {
        const cur: ProductAgg =
          map.get(it.name) ?? {
            name: it.name,
            revenue: 0,
            kg: 0,
            count: 0,
            takeHome: { revenue: 0, count: 0, kg: 0 },
            eatHere: { revenue: 0, count: 0, kg: 0 },
          };
        cur.revenue += it.total;
        cur.kg += it.kg;
        cur.count += 1;
        if (isTH) {
          cur.takeHome.revenue += it.total;
          cur.takeHome.kg += it.kg;
          cur.takeHome.count += 1;
        } else {
          cur.eatHere.revenue += it.total;
          cur.eatHere.kg += it.kg;
          cur.eatHere.count += 1;
        }
        map.set(it.name, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [data, typeFilter]);

  // Period totals (not affected by search box)
  const periodRevenue = products.reduce((a, b) => a + b.revenue, 0);
  const periodKg = products.reduce((a, b) => a + b.kg, 0);
  const periodSales = (data?.sales ?? []).filter(
    (s) => s.status === "COMPLETED" && (typeFilter === "ALL" || s.type === typeFilter),
  ).length;
  const productCount = products.length;

  // Search-filtered subset for the list & chart
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const chartData = filtered.slice(0, 6).map((p) => ({
    name: p.name,
    revenue: Math.round(p.revenue * 100) / 100,
  }));

  return (
    <PageScaffold
      title="Product Sales"
      subtitle="Which products are driving revenue"
      onBack={() => back()}
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "ALL"]}
        />
      </div>

      {/* Type filter toggle */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {(["ALL", "TAKE_HOME", "EAT_HERE"] as TypeFilter[]).map((t) => {
          const active = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-xl py-2 text-xs font-semibold tap-scale",
                active && t === "ALL" && "bg-primary text-primary-foreground",
                active && t === "TAKE_HOME" &&
                  "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
                active && t === "EAT_HERE" &&
                  "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
                !active && "bg-muted/60 text-muted-foreground",
              )}
            >
              {t === "ALL" ? "All" : t === "TAKE_HOME" ? "Take Home" : "Eat Here"}
            </button>
          );
        })}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search products…"
        className="mb-4"
      />

      {/* Top summary card */}
      <Card className="mb-4 overflow-hidden card-raised">
        <div className="bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Revenue · {periodLabel(period)}
          </p>
          <p className="mt-1 text-3xl font-bold tnum tracking-tight">
            {formatBirr(periodRevenue)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {periodSales} {periodSales === 1 ? "sale" : "sales"} ·{" "}
            {formatKg(periodKg)} sold · {productCount}{" "}
            {productCount === 1 ? "product" : "products"}
          </p>
        </div>
      </Card>

      {/* Mini stats */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatTile label="Revenue" value={<Money amount={periodRevenue} />} tone="primary" />
        <StatTile
          label="Sales Count"
          value={<span className="tnum">{periodSales}</span>}
          tone="default"
        />
        <StatTile label="Kg Sold" value={<Kg kg={periodKg} />} tone="default" />
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card className="mb-5 p-4 card-raised">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top Products by Revenue</h3>
            <span className="text-[11px] text-muted-foreground">
              {periodLabel(period)}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  stroke="oklch(0.68 0.008 55)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  stroke="oklch(0.68 0.008 55)"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.2 0 0 / 0.95)",
                    border: "1px solid oklch(0.3 0 0)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatBirr(v), "Revenue"]}
                  cursor={{ fill: "oklch(0.62 0.22 25 / 0.12)" }}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={18}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Products list */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l3 3 4-5" />
            </svg>
          }
          title="No products sold in this period."
          description="Try a wider period or a different Take Home / Eat Here filter."
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <ProductCard key={p.name} p={p} />
          ))}
        </div>
      )}
    </PageScaffold>
  );
}

// ─── Product card ───────────────────────────────────────────────────────
function ProductCard({ p }: { p: ProductAgg }) {
  return (
    <Card className="p-4 card-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">{p.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground tnum">
            {p.count} {p.count === 1 ? "sale" : "sales"} · <Kg kg={p.kg} />
          </p>
        </div>
        <p className="shrink-0 text-base font-bold tnum">
          <Money amount={p.revenue} />
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-amber-500/10 p-2.5 ring-1 ring-amber-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
            Take Home · OUT
          </p>
          <p className="mt-0.5 text-sm font-bold tnum">
            <Money amount={p.takeHome.revenue} />
          </p>
          <p className="text-[10px] text-muted-foreground tnum">
            {p.takeHome.count} sales · {formatKg(p.takeHome.kg)}
          </p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-2.5 ring-1 ring-emerald-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Eat Here · IN
          </p>
          <p className="mt-0.5 text-sm font-bold tnum">
            <Money amount={p.eatHere.revenue} />
          </p>
          <p className="text-[10px] text-muted-foreground tnum">
            {p.eatHere.count} sales · {formatKg(p.eatHere.kg)}
          </p>
        </div>
      </div>
    </Card>
  );
}
