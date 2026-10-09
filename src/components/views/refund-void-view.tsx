"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav } from "@/lib/nav";
import {
  formatBirr, formatDateTime, cn,
  type PeriodKey,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  PeriodTabs, SearchInput, EmptyState, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";
import { ReceiptDialog } from "@/components/app/receipt-dialog";
import { useLang } from "@/components/lang-provider";
import { t as translate, type Lang } from "@/lib/i18n";

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
  note: string | null;
  createdAt: string;
  items: SaleItem[];
}

interface SalesResp { sales: Sale[]; stats: { revenue: number; kgSold: number; count: number }; }

interface Settings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptHeader: string;
  receiptFooter: string;
  currency: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function useStatusLabel(): Record<SaleStatus, string> {
  const { t } = useLang();
  return {
    COMPLETED: t("salesHistory.completed"),
    VOIDED: t("salesHistory.voided"),
    REFUNDED: t("salesHistory.refunded"),
  };
}
const STATUS_TONE: Record<SaleStatus, "good" | "bad" | "warn"> = {
  COMPLETED: "good",
  VOIDED: "bad",
  REFUNDED: "warn",
};

function paymentLabelT(method: string, detail?: string | null, lang: Lang = "en"): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return translate("sell.cash", lang);
  if (m === "MOBILE") return `${translate("sell.mobile", lang)}${detail ? ` · ${detail}` : ""}`;
  if (m === "BANK") return `${translate("sell.bank", lang)}${detail ? ` · ${detail}` : ""}`;
  return method || "—";
}

async function fetchSales(period: PeriodKey, q: string): Promise<SalesResp> {
  const r = await fetch(`/api/meat/sales?period=${period}&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function RefundVoidView() {
  const { back } = useNav();
  const { t, lang } = useLang();
  const statusLabel = useStatusLabel();
  const qc = useQueryClient();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<"VOIDABLE" | "DONE">("VOIDABLE");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<{ sale: Sale; action: "VOID" | "REFUND" } | null>(null);

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const tm = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(tm);
  }, [q]);

  // Single fetch — no status filter. We split into Voidable (COMPLETED) and
  // Refunded/Voided (VOIDED|REFUNDED) client-side.
  const { data, isLoading } = useQuery<SalesResp>({
    queryKey: ["sales", "REFUND_VOID", period, debouncedQ],
    queryFn: () => fetchSales(period, debouncedQ),
  });

  // Settings for the shared ReceiptDialog
  const { data: settingsData } = useQuery<{ settings: Settings }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/meat/settings");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const all = data?.sales ?? [];
  const voidable = all.filter((s) => s.status === "COMPLETED");
  const done = all.filter((s) => s.status === "VOIDED" || s.status === "REFUNDED");

  const invalidateAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["money"] });
  }, [qc]);

  return (
    <PageScaffold
      title={t("refundVoid.title")}
      subtitle={t("refundVoid.subtitle")}
      onBack={() => back()}
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH"]}
        />
      </div>

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder={`${t("common.search")}…`}
        className="mb-4"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "VOIDABLE" | "DONE")} className="mb-3">
        <TabsList className="w-full">
          <TabsTrigger value="VOIDABLE" className="flex-1">
            {t("refundVoid.voidable")} <span className="ml-1 tnum text-[10px] text-muted-foreground">({voidable.length})</span>
          </TabsTrigger>
          <TabsTrigger value="DONE" className="flex-1">
            {t("refundVoid.reversed")} <span className="ml-1 tnum text-[10px] text-muted-foreground">({done.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="VOIDABLE" className="mt-3">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : voidable.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              }
              title={t("refundVoid.empty")}
              description={t("refundVoid.subtitle")}
            />
          ) : (
            <div className="space-y-2.5">
              {voidable.map((s) => (
                <VoidableCard
                  key={s.id}
                  sale={s}
                  onView={() => setOpenId(s.id)}
                  onAction={(action) => setConfirm({ sale: s, action })}
                  statusLabel={statusLabel}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="DONE" className="mt-3">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : done.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              }
              title={t("refundVoid.empty")}
              description={t("refundVoid.subtitle")}
            />
          ) : (
            <div className="space-y-2.5">
              {done.map((s) => (
                <DoneCard key={s.id} sale={s} onView={() => setOpenId(s.id)} statusLabel={statusLabel} lang={lang} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ReceiptDialog
        id={openId}
        onClose={() => setOpenId(null)}
        settings={settingsData?.settings}
        lang={lang}
      />

      <ConfirmDialog
        state={confirm}
        onClose={() => setConfirm(null)}
        onSuccess={() => {
          invalidateAll();
          setConfirm(null);
        }}
      />
    </PageScaffold>
  );
}

// ─── Voidable card ──────────────────────────────────────────────────────
function VoidableCard({
  sale,
  onView,
  onAction,
  statusLabel,
  lang,
}: {
  sale: Sale;
  onView: () => void;
  onAction: (action: "VOID" | "REFUND") => void;
  statusLabel: Record<SaleStatus, string>;
  lang: Lang;
}) {
  const { t } = useLang();
  const isTakeHome = sale.type === "TAKE_HOME";
  const itemCount = sale.items.length;
  return (
    <Card className="overflow-hidden card-raised">
      <div className="p-3.5">
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
                  <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>
                ) : (
                  <><path d="M3 11h18" /><path d="M5 11V9a7 7 0 0 1 14 0v2" /><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></>
                )}
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold tnum">#{sale.number}</p>
                <Pill tone="good">{statusLabel[sale.status]}</Pill>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {formatDateTime(sale.createdAt)} · {sale.cashierName || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tnum"><Money amount={sale.total} /></p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {paymentLabelT(sale.paymentMethod, sale.paymentDetail, lang)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill tone={isTakeHome ? "warn" : "good"}>{isTakeHome ? t("sell.takeHome") : t("sell.eatHere")}</Pill>
          <span className="text-[11px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? t("common.item") : t("common.items")} · <Kg kg={sale.totalKg} />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-border/60 bg-border/60">
        <button
          onClick={onView}
          className="bg-card px-2 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground tap-scale"
        >
          {t("common.view")}
        </button>
        <button
          onClick={() => onAction("VOID")}
          className="bg-card px-2 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 tap-scale"
        >
          {t("refundVoid.void")}
        </button>
        <button
          onClick={() => onAction("REFUND")}
          className="bg-card px-2 py-2.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 tap-scale"
        >
          {t("refundVoid.refund")}
        </button>
      </div>
    </Card>
  );
}

// ─── Done (refunded/voided) card ────────────────────────────────────────
function DoneCard({ sale, onView, statusLabel, lang }: { sale: Sale; onView: () => void; statusLabel: Record<SaleStatus, string>; lang: Lang }) {
  const { t } = useLang();
  const isTakeHome = sale.type === "TAKE_HOME";
  const isVoided = sale.status === "VOIDED";
  const itemCount = sale.items.length;
  return (
    <Card className="overflow-hidden card-raised">
      <button onClick={onView} className="block w-full p-3.5 text-left tap-scale">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                isVoided ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isVoided ? (
                  <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>
                ) : (
                  <><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></>
                )}
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold tnum">#{sale.number}</p>
                <Pill tone={STATUS_TONE[sale.status]}>{statusLabel[sale.status]}</Pill>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {formatDateTime(sale.createdAt)} · {sale.cashierName || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tnum text-muted-foreground line-through">
              <Money amount={sale.total} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {paymentLabelT(sale.paymentMethod, sale.paymentDetail, lang)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill tone={isVoided ? "muted" : isTakeHome ? "warn" : "good"}>{isTakeHome ? t("sell.takeHome") : t("sell.eatHere")}</Pill>
          <span className="text-[11px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? t("common.item") : t("common.items")} · <Kg kg={sale.totalKg} />
          </span>
        </div>
      </button>
    </Card>
  );
}

// ─── Confirm dialog (Void / Refund) ─────────────────────────────────────
function ConfirmDialog({
  state,
  onClose,
  onSuccess,
}: {
  state: { sale: Sale; action: "VOID" | "REFUND" } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLang();
  const [note, setNote] = React.useState("");
  const action = state?.action;
  const sale = state?.sale;

  // Reset note whenever a new dialog opens
  React.useEffect(() => {
    if (state) setNote("");
  }, [state]);

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!sale || !action) throw new Error("no state");
      const r = await fetch(`/api/meat/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(
        action === "VOID"
          ? `${t("refundVoid.voided")} #${sale?.number}`
          : `${t("refundVoid.refunded")} #${sale?.number}`,
      );
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || t("saleFailed"));
    },
  });

  const isVoid = action === "VOID";
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                isVoid ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </span>
            {isVoid ? t("refundVoid.voidConfirm") : t("refundVoid.refundConfirm")}
          </DialogTitle>
          <DialogDescription>
            {t("refundVoid.irreversible")}. #{sale?.number} · {formatBirr(sale?.total ?? 0)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rv-note" className="text-xs text-muted-foreground">
            {t("refundVoid.reason")}
          </Label>
          <Textarea
            id="rv-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="…"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={cn(
              "text-primary-foreground",
              isVoid ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600",
            )}
          >
            {mutation.isPending ? t("common.loading") : isVoid ? t("refundVoid.voidSale") : t("refundVoid.refundSale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
