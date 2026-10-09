"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { useLang } from "@/components/lang-provider";
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
  const { t } = useLang();
  const [period, setPeriod] = React.useState<PeriodKey>("7D");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL");
  const [query, setQuery] = React.useState("");
  const [customFrom, setCustomFrom] = React.useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = React.useState<string>(() => new Date().toISOString().slice(0, 10));

  const isCustom = period === "CUSTOM";

  const { data, isLoading } = useQuery<SalesResp>({
    queryKey: ["sales", period, customFrom, customTo],
    queryFn: async () => {
      if (isCustom) {
        const r = await fetch(`/api/meat/sales?period=ALL`);
        if (!r.ok) throw new Error("failed");
        const j: SalesResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        j.sales = j.sales.filter((s) => { const c = new Date(s.createdAt); return c >= fromD && c <= toD; });
        const completed = j.sales.filter((s) => s.status === "COMPLETED");
        j.stats = { revenue: completed.reduce((a, b) => a + b.total, 0), kgSold: completed.reduce((a, b) => a + b.totalKg, 0), count: completed.length };
        return j;
      }
      return fetchSales(period);
    },
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
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR", "CUSTOM"]}
        />
      </div>

      {isCustom && (
        <Card className="mb-4 grid grid-cols-2 gap-3 p-3 card-raised">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm tnum" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm tnum" />
          </div>
        </Card>
      )}

      {/* Type filter toggle */}
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {(["ALL", "TAKE_HOME", "EAT_HERE"] as TypeFilter[]).map((tf) => {
          const active = typeFilter === tf;
          return (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={cn(
                "rounded-xl py-2 text-xs font-semibold tap-scale",
                active && tf === "ALL" && "bg-primary text-primary-foreground",
                active && tf === "TAKE_HOME" &&
                  "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
                active && tf === "EAT_HERE" &&
                  "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
                !active && "bg-muted/60 text-muted-foreground",
              )}
            >
              {tf === "ALL" ? t("common.all") : tf === "TAKE_HOME" ? t("home.takeHome") : t("home.eatHere")}
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
        <StatTile label={t("salesHistory.revenue")} value={<Money amount={periodRevenue} />} tone="primary" />
        <StatTile
          label={t("salesHistory.sales")}
          value={<span className="tnum">{periodSales}</span>}
          tone="default"
        />
        <StatTile label={t("salesHistory.totalKg")} value={<Kg kg={periodKg} />} tone="default" />
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card className="mb-5 p-4 card-raised">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("home.topProducts")}</h3>
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
          description="Try a wider period or a different filter."
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
  const { t } = useLang();
  const avgPricePerKg = p.kg > 0 ? Math.round((p.revenue / p.kg) * 100) / 100 : 0;
  return (
    <Card className="p-3.5 card-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{p.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground tnum">
            {p.count} {p.count === 1 ? "sale" : "sales"} · <Kg kg={p.kg} /> · avg {formatBirr(avgPricePerKg)}/kg
          </p>
        </div>
        <p className="shrink-0 text-base font-bold tnum text-emerald-400">
          <Money amount={p.revenue} />
        </p>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">{t("home.takeHome")} · {t("common.out")}</p>
          <p className="mt-0.5 text-sm font-bold tnum"><Money amount={p.takeHome.revenue} /></p>
          <p className="text-[10px] text-muted-foreground tnum">{p.takeHome.count} {p.takeHome.count === 1 ? t("home.sales") : t("salesHistory.salesPlural")} · {formatKg(p.takeHome.kg)}</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{t("home.eatHere")} · {t("common.in")}</p>
          <p className="mt-0.5 text-sm font-bold tnum"><Money amount={p.eatHere.revenue} /></p>
          <p className="text-[10px] text-muted-foreground tnum">{p.eatHere.count} {p.eatHere.count === 1 ? t("home.sales") : t("salesHistory.salesPlural")} · {formatKg(p.eatHere.kg)}</p>
        </div>
      </div>
    </Card>
  );
}
