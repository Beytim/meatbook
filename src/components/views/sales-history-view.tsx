"use client";

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  formatBirr, formatKg, formatDateTime, cn,
  type PeriodKey,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PeriodTabs, SearchInput, EmptyState, StatTile, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

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

const STATUS_TONE: Record<SaleStatus, "good" | "bad" | "warn"> = {
  COMPLETED: "good", VOIDED: "bad", REFUNDED: "warn",
};
function useStatusLabel(): Record<SaleStatus, string> {
  const { t } = useLang();
  return {
    COMPLETED: t("salesHistory.completed"),
    VOIDED: t("salesHistory.voided"),
    REFUNDED: t("salesHistory.refunded"),
  };
}

function usePaymentLabel(): (method: string, detail?: string | null) => string {
  const { t } = useLang();
  return (method: string, detail?: string | null): string => {
    const m = (method || "").toUpperCase();
    if (m === "CASH") return t("sell.cash");
    if (m === "MOBILE") return `${t("sell.mobile")}${detail ? ` · ${detail}` : ""}`;
    if (m === "BANK") return `${t("sell.bank")}${detail ? ` · ${detail}` : ""}`;
    if (m === "CREDIT") return t("sell.credit");
    return method || "—";
  };
}

async function fetchSales(period: PeriodKey, q: string, status?: string): Promise<SalesResp> {
  let url = `/api/meat/sales?period=${period}&q=${encodeURIComponent(q)}`;
  if (status && status !== "ALL") url += `&status=${status}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export function SalesHistoryView() {
  const { back, go } = useNav();
  const { t } = useLang();
  const statusLabel = useStatusLabel();
  const paymentLabel = usePaymentLabel();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | SaleStatus>("ALL");
  const [payFilter, setPayFilter] = React.useState<"ALL" | "CASH" | "MOBILE" | "BANK" | "CREDIT">("ALL");
  const [customFrom, setCustomFrom] = React.useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [openId, setOpenId] = React.useState<string | null>(null);

  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => { const tm = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(tm); }, [q]);

  const isCustom = period === "CUSTOM";
  const queryKey = isCustom
    ? ["sales", "CUSTOM", customFrom, customTo, debouncedQ, statusFilter, payFilter]
    : ["sales", period, debouncedQ, statusFilter, payFilter];

  const { data, isLoading } = useQuery<SalesResp>({
    queryKey,
    queryFn: async () => {
      if (isCustom) {
        const r = await fetch(`/api/meat/sales?period=ALL&q=${encodeURIComponent(debouncedQ)}`);
        if (!r.ok) throw new Error("failed");
        const j: SalesResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        let filtered = j.sales.filter((s) => { const c = new Date(s.createdAt); return c >= fromD && c <= toD; });
        if (statusFilter !== "ALL") filtered = filtered.filter((s) => s.status === statusFilter);
        if (payFilter !== "ALL") filtered = filtered.filter((s) => s.paymentMethod === payFilter);
        const completed = filtered.filter((s) => s.status === "COMPLETED");
        return { sales: filtered, stats: { revenue: completed.reduce((a, b) => a + b.total, 0), kgSold: completed.reduce((a, b) => a + b.totalKg, 0), count: completed.length } };
      }
      const r = await fetchSales(period, debouncedQ, statusFilter !== "ALL" ? statusFilter : undefined);
      if (payFilter !== "ALL") r.sales = r.sales.filter((s) => s.paymentMethod === payFilter);
      return r;
    },
  });

  const stats = data?.stats;
  const sales = data?.sales ?? [];

  return (
    <PageScaffold title={t("salesHistory.title")} subtitle={t("salesHistory.allTransactions")} onBack={() => back()}>
      <div className="mb-3">
        <PeriodTabs value={period} onChange={setPeriod} periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR", "CUSTOM"]} />
      </div>

      {isCustom && (
        <Card className="mb-3 grid grid-cols-2 gap-3 p-3 card-raised">
          <div>
            <Label className="text-xs text-muted-foreground">{t("common.from")}</Label>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 tnum" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("common.to")}</Label>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 tnum" />
          </div>
        </Card>
      )}

      {/* Status filter */}
      <div className="mb-2 flex gap-1.5">
        {(["ALL", "COMPLETED", "VOIDED", "REFUNDED"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("rounded-full px-3 py-1 text-[11px] font-semibold tap-scale", statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            {s === "ALL" ? t("common.all") : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* Payment filter */}
      <div className="mb-3 flex gap-1.5">
        {(["ALL", "CASH", "MOBILE", "BANK", "CREDIT"] as const).map((p) => (
          <button key={p} onClick={() => setPayFilter(p)}
            className={cn("rounded-full px-3 py-1 text-[11px] font-semibold tap-scale", payFilter === p ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            {p === "ALL" ? t("salesHistory.allPay") : p === "CASH" ? t("sell.cash") : p === "MOBILE" ? t("sell.mobile") : p === "BANK" ? t("sell.bank") : t("sell.credit")}
          </button>
        ))}
      </div>

      <SearchInput value={q} onChange={setQ} placeholder={`${t("common.search")}…`} className="mb-3" />

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatTile label={t("salesHistory.revenue")} value={<Money amount={stats?.revenue ?? 0} />} sub={isCustom ? t("common.custom").toLowerCase() : t("common.today").toLowerCase()} tone="primary" />
        <StatTile label={t("salesHistory.sales")} value={<span className="tnum">{stats?.count ?? 0}</span>} sub={t("salesHistory.completed").toLowerCase()} tone="default" />
        <StatTile label={t("salesHistory.totalKg")} value={<Kg kg={stats?.kgSold ?? 0} />} sub={t("home.soldToday2").toLowerCase()} tone="default" />
      </div>

      {/* List — scrollable */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>}
          title={t("salesHistory.empty")}
          description={t("salesHistory.empty")}
          action={<Button onClick={() => go("SELL")} className="bg-primary text-primary-foreground">{t("salesHistory.startSale")}</Button>}
        />
      ) : (
        <div className="mb-scroll max-h-[55vh] space-y-2 overflow-y-auto">
          {sales.map((s) => (
            <SaleRow key={s.id} sale={s} onOpen={() => setOpenId(s.id)} statusLabel={statusLabel} paymentLabel={paymentLabel} />
          ))}
        </div>
      )}

      <ReceiptDialog id={openId} onClose={() => setOpenId(null)} statusLabel={statusLabel} paymentLabel={paymentLabel} />
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function SaleRow({ sale, onOpen, statusLabel, paymentLabel }: { sale: Sale; onOpen: () => void; statusLabel: Record<SaleStatus, string>; paymentLabel: (m: string, d?: string | null) => string }) {
  const { t } = useLang();
  const isTakeHome = sale.type === "TAKE_HOME";
  const isCompleted = sale.status === "COMPLETED";
  const itemCount = sale.items.length;
  return (
    <Card className="overflow-hidden card-raised">
      <button onClick={onOpen} className="block w-full p-3 text-left tap-scale">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", isTakeHome ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400")}>
              <span className="text-[9px] font-bold">{isTakeHome ? "OUT" : "IN"}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold tnum">#{sale.number}</p>
                <Pill tone={STATUS_TONE[sale.status]}>{statusLabel[sale.status]}</Pill>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">{formatDateTime(sale.createdAt)} · {sale.cashierName || "—"}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("text-sm font-bold tnum", isCompleted ? "text-foreground" : "text-muted-foreground line-through")}><Money amount={sale.total} /></p>
            <p className="text-[10px] text-muted-foreground">{paymentLabel(sale.paymentMethod, sale.paymentDetail)}</p>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground tnum">{itemCount} {itemCount > 1 ? t("common.items") : t("common.item")} · <Kg kg={sale.totalKg} /></span>
        </div>
      </button>
    </Card>
  );
}

// ─── Receipt dialog with void/refund ────────────────────────────────────
function ReceiptDialog({ id, onClose, statusLabel, paymentLabel }: { id: string | null; onClose: () => void; statusLabel: Record<SaleStatus, string>; paymentLabel: (m: string, d?: string | null) => string }) {
  const { go } = useNav();
  const { t } = useLang();
  const { data, isLoading } = useQuery<{ sale: Sale }>({
    queryKey: ["sale", id],
    queryFn: async () => { const r = await fetch(`/api/meat/sales/${id}`); if (!r.ok) throw new Error("failed"); return r.json(); },
    enabled: !!id,
  });
  const sale = data?.sale;

  const [confirmAction, setConfirmAction] = React.useState<"VOID" | "REFUND" | null>(null);
  const [actionNote, setActionNote] = React.useState("");

  const act = useMutation({
    mutationFn: async () => {
      if (!id || !confirmAction) return;
      const r = await fetch(`/api/meat/sales/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction, note: actionNote.trim() || undefined }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(confirmAction === "VOID" ? t("refundVoid.voided") : t("refundVoid.refunded"));
      setConfirmAction(null); setActionNote("");
      onClose();
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) { onClose(); setConfirmAction(null); setActionNote(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{t("receipts.receipt")}</span>
            {sale && <span className="tnum">#{sale.number}</span>}
            {sale && <Pill tone={STATUS_TONE[sale.status]}>{statusLabel[sale.status]}</Pill>}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("receipts.receipt")} #{sale?.number}.</DialogDescription>
        </DialogHeader>
        {isLoading || !sale ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2">
                <MetaCell label={t("common.date")} value={formatDateTime(sale.createdAt)} />
                <MetaCell label={t("common.cashier")} value={sale.cashierName || "—"} />
                <MetaCell label={t("common.type")} value={sale.type === "TAKE_HOME" ? `${t("sell.takeHome")} · OUT` : `${t("sell.eatHere")} · IN`} tone={sale.type === "TAKE_HOME" ? "amber" : "emerald"} />
                <MetaCell label={t("common.payment")} value={paymentLabel(sale.paymentMethod, sale.paymentDetail)} />
              </div>

              {/* Items */}
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("common.item")}</span><span>{t("common.total")}</span>
                </div>
                {sale.items.map((it, i) => (
                  <div key={i} className="border-b border-border/40 px-3 py-2 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{it.name}</p>
                        <p className="text-[11px] text-muted-foreground tnum">{formatBirr(it.unitPrice)}/kg · <Kg kg={it.kg} /></p>
                      </div>
                      <p className="text-sm font-semibold tnum"><Money amount={it.total} /></p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand total */}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/20">
                <span className="text-sm font-semibold">{t("sell.grandTotal")}</span>
                <span className="text-lg font-bold tnum"><Money amount={sale.total} /></span>
              </div>
            </div>

            {/* Void/Refund actions — only for completed sales */}
            {sale.status === "COMPLETED" && !confirmAction && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => go("RECEIPTS")}>{t("receipts.reprint")}</Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs text-red-400 hover:text-red-300" onClick={() => setConfirmAction("VOID")}>{t("refundVoid.void")}</Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs text-amber-400 hover:text-amber-300" onClick={() => setConfirmAction("REFUND")}>{t("refundVoid.refund")}</Button>
              </div>
            )}

            {/* Confirm action */}
            {confirmAction && (
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <p className="text-sm font-semibold text-red-400">
                  {confirmAction === "VOID" ? t("refundVoid.voidConfirm") : t("refundVoid.refundConfirm")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  #{sale.number} · {formatBirr(sale.total)}. {t("refundVoid.irreversible")}.
                </p>
                <Input value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder={t("refundVoid.reason")} className="h-9 text-xs" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setConfirmAction(null); setActionNote(""); }}>{t("common.cancel")}</Button>
                  <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={() => act.mutate()} disabled={act.isPending}>
                    {act.isPending ? t("common.loading") : `${t("common.confirm")} ${confirmAction === "VOID" ? t("refundVoid.void") : t("refundVoid.refund")}`}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetaCell({ label, value, tone }: { label: string; value: string; tone?: "amber" | "emerald" }) {
  const toneCls = tone === "amber" ? "text-amber-400" : tone === "emerald" ? "text-emerald-400" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate text-xs font-medium", toneCls)}>{value}</p>
    </div>
  );
}
