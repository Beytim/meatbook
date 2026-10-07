"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  formatBirr, formatKg, formatDateTime, cn,
  type PeriodKey, periodLabel,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  PeriodTabs, SearchInput, EmptyState, StatTile, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
interface SaleItem { name: string; unitPrice: number; kg: number; total: number; }
type SaleStatus = "COMPLETED" | "VOIDED" | "REFUNDED";
type SaleType = "TAKE_HOME" | "EAT_HERE";

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

// ─── Helpers ────────────────────────────────────────────────────────────
const STATUS_TONE: Record<SaleStatus, "good" | "bad" | "warn"> = {
  COMPLETED: "good",
  VOIDED: "bad",
  REFUNDED: "warn",
};
const STATUS_LABEL: Record<SaleStatus, string> = {
  COMPLETED: "Completed",
  VOIDED: "Voided",
  REFUNDED: "Refunded",
};

function paymentLabel(method: string, detail?: string | null): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return "Cash";
  if (m === "MOBILE") return `Mobile${detail ? ` · ${detail}` : ""}`;
  if (m === "BANK") return `Bank${detail ? ` · ${detail}` : ""}`;
  return method || "—";
}

async function fetchSales(period: PeriodKey, q: string): Promise<SalesResp> {
  const r = await fetch(`/api/meat/sales?period=${period}&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function SalesHistoryView() {
  const { back, go } = useNav();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [customFrom, setCustomFrom] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = React.useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Debounce search to avoid thrashing the API on every keystroke
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const isCustom = period === "CUSTOM";
  const queryKey = isCustom
    ? ["sales", "CUSTOM", customFrom, customTo, debouncedQ]
    : ["sales", period, debouncedQ];

  const { data, isLoading } = useQuery<SalesResp>({
    queryKey,
    queryFn: async () => {
      if (isCustom) {
        // API has no from/to support, so fetch ALL and filter client-side
        const r = await fetch(`/api/meat/sales?period=ALL&q=${encodeURIComponent(debouncedQ)}`);
        if (!r.ok) throw new Error("failed");
        const j: SalesResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        const filtered = j.sales.filter((s) => {
          const c = new Date(s.createdAt);
          return c >= fromD && c <= toD;
        });
        const completed = filtered.filter((s) => s.status === "COMPLETED");
        return {
          sales: filtered,
          stats: {
            revenue: completed.reduce((a, b) => a + b.total, 0),
            kgSold: completed.reduce((a, b) => a + b.totalKg, 0),
            count: completed.length,
          },
        };
      }
      return fetchSales(period, debouncedQ);
    },
  });

  const stats = data?.stats;
  const sales = data?.sales ?? [];

  return (
    <PageScaffold
      title="Sales History"
      subtitle="All transactions, newest first"
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
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 tnum"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 tnum"
            />
          </div>
        </Card>
      )}

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search sale #, product, cashier…"
        className="mb-4"
      />

      {/* Stat tiles */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <StatTile
          label="Revenue"
          value={<Money amount={stats?.revenue ?? 0} />}
          sub={periodLabel(period)}
          tone="primary"
        />
        <StatTile
          label="Sales"
          value={<span className="tnum">{stats?.count ?? 0}</span>}
          sub="completed"
          tone="default"
        />
        <StatTile
          label="Total Kg"
          value={<Kg kg={stats?.kgSold ?? 0} />}
          sub="sold"
          tone="default"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" />
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
            </svg>
          }
          title="No sales in this period."
          description="Your first sale will appear here. Tap Sell to begin a new sale."
          action={
            <Button
              onClick={() => go("SELL")}
              className="bg-primary text-primary-foreground meat-glow"
            >
              Start a Sale
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {sales.map((s) => (
            <SaleRow key={s.id} sale={s} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}

      <ReceiptDialog id={openId} onClose={() => setOpenId(null)} />
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function SaleRow({ sale, onOpen }: { sale: Sale; onOpen: () => void }) {
  const isTakeHome = sale.type === "TAKE_HOME";
  const isCompleted = sale.status === "COMPLETED";
  const itemCount = sale.items.length;
  return (
    <Card className="overflow-hidden card-raised">
      <button onClick={onOpen} className="block w-full p-3.5 text-left tap-scale">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                isTakeHome
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-emerald-500/15 text-emerald-400",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isTakeHome ? (
                  <>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M9 22V12h6v10" />
                  </>
                ) : (
                  <>
                    <path d="M3 11h18" />
                    <path d="M5 11V9a7 7 0 0 1 14 0v2" />
                    <path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
                  </>
                )}
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold tnum">#{sale.number}</p>
                <Pill tone={STATUS_TONE[sale.status]}>{STATUS_LABEL[sale.status]}</Pill>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {formatDateTime(sale.createdAt)} · {sale.cashierName || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-sm font-bold tnum",
                isCompleted ? "text-foreground" : "text-muted-foreground line-through",
              )}
            >
              <Money amount={sale.total} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {paymentLabel(sale.paymentMethod, sale.paymentDetail)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Pill tone={isTakeHome ? "warn" : "good"}>
            {isTakeHome ? "Take Home · OUT" : "Eat Here · IN"}
          </Pill>
          <span className="text-[11px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"} · <Kg kg={sale.totalKg} />
          </span>
        </div>
      </button>
    </Card>
  );
}

// ─── Receipt dialog ─────────────────────────────────────────────────────
function ReceiptDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ sale: Sale }>({
    queryKey: ["sale", id],
    queryFn: async () => {
      const r = await fetch(`/api/meat/sales/${id}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!id,
  });
  const sale = data?.sale;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Receipt</span>
            {sale && <span className="tnum">#{sale.number}</span>}
            {sale && <Pill tone={STATUS_TONE[sale.status]}>{STATUS_LABEL[sale.status]}</Pill>}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !sale ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading receipt…
          </div>
        ) : (
          <>

            <div className="space-y-3">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <MetaCell label="Date" value={formatDateTime(sale.createdAt)} />
                <MetaCell label="Cashier" value={sale.cashierName || "—"} />
                <MetaCell
                  label="Type"
                  value={sale.type === "TAKE_HOME" ? "Take Home · OUT" : "Eat Here · IN"}
                  tone={sale.type === "TAKE_HOME" ? "amber" : "emerald"}
                />
                <MetaCell
                  label="Payment"
                  value={paymentLabel(sale.paymentMethod, sale.paymentDetail)}
                />
              </div>

              {/* Line items */}
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Item</span>
                  <span>Total</span>
                </div>
                {sale.items.map((it, i) => (
                  <div
                    key={i}
                    className="border-b border-border/40 px-3 py-2.5 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{it.name}</p>
                        <p className="text-[11px] text-muted-foreground tnum">
                          {formatBirr(it.unitPrice)}/kg · <Kg kg={it.kg} />
                        </p>
                      </div>
                      <p className="text-sm font-semibold tnum">
                        <Money amount={it.total} />
                      </p>
                    </div>
                  </div>
                ))}
                {sale.items.length === 0 && (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No items
                  </div>
                )}
              </div>

              {/* Grand total */}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/20">
                <span className="text-sm font-semibold">Grand total</span>
                <span className="text-lg font-bold tnum">
                  <Money amount={sale.total} />
                </span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetaCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "emerald";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-400"
      : tone === "emerald"
      ? "text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("truncate text-xs font-medium", toneCls)}>{value}</p>
    </div>
  );
}
