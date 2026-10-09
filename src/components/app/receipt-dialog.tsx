"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  formatBirr, formatKg, formatDateTime, formatTime,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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

interface Settings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptHeader: string;
  receiptFooter: string;
  currency: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────
function paymentLabelT(method: string, detail?: string | null, lang: Lang = "en"): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return translate("sell.cash", lang);
  if (m === "MOBILE") return `${translate("sell.mobile", lang)}${detail ? ` · ${detail}` : ""}`;
  if (m === "BANK") return `${translate("sell.bank", lang)}${detail ? ` · ${detail}` : ""}`;
  if (m === "CREDIT") return translate("sell.credit", lang);
  return method || "—";
}

// ─── Shared ReceiptDialog ───────────────────────────────────────────────
// Used by: ReceiptsView, RefundVoidView, SalesHistoryView
// Features: thermal receipt layout, Reprint (toast), Share (navigator.share/clipboard)
// Optional: Void/Refund actions (showActions prop)
export function ReceiptDialog({
  id,
  onClose,
  settings,
  lang,
  showActions = false,
}: {
  id: string | null;
  onClose: () => void;
  settings?: Settings;
  lang?: Lang;
  showActions?: boolean;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const effectiveLang: Lang = lang ?? "en";

  const [confirmAction, setConfirmAction] = React.useState<"VOID" | "REFUND" | null>(null);
  const [actionNote, setActionNote] = React.useState("");

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

  // Reset confirm state when dialog closes or changes sale
  React.useEffect(() => {
    if (!id) {
      setConfirmAction(null);
      setActionNote("");
    }
  }, [id]);

  const onShare = React.useCallback(async () => {
    if (!sale) return;
    const text = buildReceiptText(sale, settings, effectiveLang);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: `${t("receipts.receipt")} #${sale.number}`, text });
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success(t("receipts.share"));
        return;
      }
    } catch {
      // ignore
    }
    toast.error("Could not share receipt");
  }, [sale, settings, effectiveLang, t]);

  const onReprint = React.useCallback(() => {
    toast.success(`${t("receipts.reprint")} #${sale?.number ?? ""}`);
  }, [sale, t]);

  // Void/Refund mutation — with proper invalidations (fixes bug #2)
  const actMut = useMutation({
    mutationFn: async () => {
      if (!id || !confirmAction) return;
      const r = await fetch(`/api/meat/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction, note: actionNote.trim() || undefined }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(confirmAction === "VOID" ? t("refundVoid.voided") : t("refundVoid.refunded"));
      // FIX bug #2: invalidate all affected queries
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      setConfirmAction(null);
      setActionNote("");
      onClose();
    },
    onError: () => toast.error("Could not process"),
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) { onClose(); setConfirmAction(null); setActionNote(""); } }}>
      <DialogContent className="max-w-md p-4 sm:p-5">
        <DialogHeader className="text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-base">
            <span>{t("receipts.receipt")}</span>
            {sale && <span className="tnum">#{sale.number}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Receipt details for sale #{sale?.number}.</DialogDescription>
        </DialogHeader>
        {isLoading || !sale ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto px-1">
              <div className="mx-auto max-w-[320px] rounded-xl bg-background p-4 font-mono text-[12px] leading-relaxed text-foreground ring-1 ring-border/60">
                <div className="text-center">
                  <p className="text-[13px] font-bold tracking-tight">
                    {settings?.receiptHeader || settings?.shopName || "Kera Fresh Meat Shop"}
                  </p>
                  {settings?.shopPhone && (
                    <p className="text-[11px] text-muted-foreground">{settings.shopPhone}</p>
                  )}
                  {settings?.shopAddress && (
                    <p className="text-[11px] text-muted-foreground">{settings.shopAddress}</p>
                  )}
                </div>
                <div className="my-2 border-t border-dashed border-border/70" />
                <div className="space-y-0.5">
                  <ReceiptRow k={`${t("salesHistory.sale")} #`} v={`#${sale.number}`} />
                  <ReceiptRow k={t("common.date")} v={formatDateTime(sale.createdAt)} />
                  <ReceiptRow k={t("common.cashier")} v={sale.cashierName || "—"} />
                  <ReceiptRow k={t("common.type")} v={sale.type === "TAKE_HOME" ? t("sell.takeHome") : t("sell.eatHere")} />
                  <ReceiptRow k={t("common.payment")} v={paymentLabelT(sale.paymentMethod, sale.paymentDetail, effectiveLang)} />
                </div>
                <div className="my-2 border-t border-dashed border-border/70" />
                <div className="space-y-1">
                  {sale.items.map((it, i) => (
                    <div key={i}>
                      <p className="truncate font-medium">{it.name}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="tnum">
                          {formatKg(it.kg)} × {formatBirr(it.unitPrice)}
                        </span>
                        <span className="tnum font-medium text-foreground">{formatBirr(it.total)}</span>
                      </div>
                    </div>
                  ))}
                  {sale.items.length === 0 && (
                    <p className="text-center text-muted-foreground">{t("sell.emptyCart")}</p>
                  )}
                </div>
                <div className="my-2 border-t border-dashed border-border/70" />
                <div className="flex items-center justify-between text-[14px] font-bold">
                  <span>{t("common.total").toUpperCase()}</span>
                  <span className="tnum">{formatBirr(sale.total)}</span>
                </div>
                <div className="my-2 border-t border-dashed border-border/70" />
                <p className="text-center text-[11px] text-muted-foreground">
                  {settings?.receiptFooter || "Thank you! Meat sold by kg. Keep refrigerated."}
                </p>
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  {formatTime(sale.createdAt)} · {sale.cashierName || t("common.cashier")}
                </p>
              </div>
            </div>

            <Separator className="my-1" />

            {/* Action buttons — Reprint + Share always; Void/Refund only if showActions and sale is COMPLETED */}
            {!confirmAction ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onReprint} className="w-full">
                  <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />
                  </svg>
                  {t("receipts.reprint")}
                </Button>
                <Button onClick={onShare} className="w-full bg-primary text-primary-foreground">
                  <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" />
                  </svg>
                  {t("receipts.share")}
                </Button>
              </div>
            ) : null}

            {/* Void/Refund actions — only for completed sales, only if showActions */}
            {showActions && sale.status === "COMPLETED" && !confirmAction && (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs text-red-400 hover:text-red-300" onClick={() => setConfirmAction("VOID")}>
                  {t("refundVoid.void")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs text-amber-400 hover:text-amber-300" onClick={() => setConfirmAction("REFUND")}>
                  {t("refundVoid.refund")}
                </Button>
              </div>
            )}

            {/* Confirm action with reason */}
            {confirmAction && (
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <p className="text-sm font-semibold text-red-400">
                  {confirmAction === "VOID" ? t("refundVoid.voidConfirm") : t("refundVoid.refundConfirm")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("refundVoid.irreversible")}
                </p>
                <input
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={t("refundVoid.reason")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { setConfirmAction(null); setActionNote(""); }}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => actMut.mutate()}
                    disabled={actMut.isPending}
                  >
                    {actMut.isPending ? "…" : confirmAction === "VOID" ? t("refundVoid.voidSale") : t("refundVoid.refundSale")}
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

// ─── Row helper ─────────────────────────────────────────────────────────
function ReceiptRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

// ─── Build plain-text receipt for sharing ───────────────────────────────
function buildReceiptText(sale: Sale, settings: Settings | undefined, lang: Lang): string {
  const header = settings?.receiptHeader || settings?.shopName || "Kera Fresh Meat Shop";
  const footer = settings?.receiptFooter || "Thank you! Meat sold by kg. Keep refrigerated.";
  const lines: string[] = [];
  lines.push(header);
  lines.push("=".repeat(28));
  lines.push(`${translate("salesHistory.sale", lang)} #   : #${sale.number}`);
  lines.push(`${translate("common.date", lang)}      : ${formatDateTime(sale.createdAt)}`);
  lines.push(`${translate("common.cashier", lang)}   : ${sale.cashierName || "—"}`);
  lines.push(`${translate("common.type", lang)}      : ${sale.type === "TAKE_HOME" ? translate("sell.takeHome", lang) : translate("sell.eatHere", lang)}`);
  lines.push(`${translate("common.payment", lang)}   : ${paymentLabelT(sale.paymentMethod, sale.paymentDetail, lang)}`);
  lines.push("-".repeat(28));
  for (const it of sale.items) {
    lines.push(`${it.name}`);
    lines.push(`  ${formatKg(it.kg)} x ${formatBirr(it.unitPrice)} = ${formatBirr(it.total)}`);
  }
  lines.push("-".repeat(28));
  lines.push(`${translate("common.total", lang).toUpperCase()}     : ${formatBirr(sale.total)}`);
  lines.push("=".repeat(28));
  lines.push(footer);
  return lines.join("\n");
}
