"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav } from "@/lib/nav";
import {
  formatBirr, formatKg, formatDateTime, formatTime, cn,
  type PeriodKey,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  PeriodTabs, SearchInput, EmptyState, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";
import { t as translate, type Lang } from "@/lib/i18n";

// Re-export ReceiptDialog from shared location (backward compat)
export { ReceiptDialog } from "@/components/app/receipt-dialog";
import { ReceiptDialog } from "@/components/app/receipt-dialog";

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

// ─── Helper ─────────────────────────────────────────────────────────────
function paymentLabelT(method: string, detail?: string | null, lang: Lang = "en"): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return translate("sell.cash", lang);
  if (m === "MOBILE") return `${translate("sell.mobile", lang)}${detail ? ` · ${detail}` : ""}`;
  if (m === "BANK") return `${translate("sell.bank", lang)}${detail ? ` · ${detail}` : ""}`;
  return method || "—";
}

async function fetchSales(period: PeriodKey, q: string): Promise<SalesResp> {
  const r = await fetch(`/api/meat/sales?period=${period}&status=COMPLETED&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function ReceiptsView() {
  const { back } = useNav();
  const { t, lang } = useLang();
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

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const tm = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(tm);
  }, [q]);

  const isCustom = period === "CUSTOM";
  const queryKey = isCustom
    ? ["sales", "RECEIPTS", "CUSTOM", customFrom, customTo, debouncedQ]
    : ["sales", "RECEIPTS", period, debouncedQ];

  const { data, isLoading } = useQuery<SalesResp>({
    queryKey,
    queryFn: async () => {
      if (isCustom) {
        const r = await fetch(`/api/meat/sales?period=ALL&status=COMPLETED&q=${encodeURIComponent(debouncedQ)}`);
        if (!r.ok) throw new Error("failed");
        const j: SalesResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        const filtered = j.sales.filter((s) => {
          const c = new Date(s.createdAt);
          return c >= fromD && c <= toD;
        });
        return {
          sales: filtered,
          stats: {
            revenue: filtered.reduce((a, b) => a + b.total, 0),
            kgSold: filtered.reduce((a, b) => a + b.totalKg, 0),
            count: filtered.length,
          },
        };
      }
      return fetchSales(period, debouncedQ);
    },
  });

  // Settings (for the thermal receipt header/footer) — cached app-wide.
  const { data: settingsData } = useQuery<{ settings: Settings }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/meat/settings");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const settings = settingsData?.settings;

  const sales = data?.sales ?? [];

  return (
    <PageScaffold
      title={t("receipts.title")}
      subtitle={t("receipts.subtitle")}
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
            <Label className="text-xs text-muted-foreground">{t("common.from")}</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 tnum"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("common.to")}</Label>
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
        placeholder={`${t("common.search")}…`}
        className="mb-4"
      />

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
          }
          title={t("receipts.noReceipts")}
          description={t("receipts.subtitle")}
        />
      ) : (
        <div className="space-y-2.5">
          {sales.map((s) => (
            <ReceiptCard key={s.id} sale={s} onOpen={() => setOpenId(s.id)} lang={lang} />
          ))}
        </div>
      )}

      <ReceiptDialog
        id={openId}
        onClose={() => setOpenId(null)}
        settings={settings}
        lang={lang}
      />
    </PageScaffold>
  );
}

// ─── Receipt card ───────────────────────────────────────────────────────
function ReceiptCard({ sale, onOpen, lang }: { sale: Sale; onOpen: () => void; lang: Lang }) {
  const { t } = useLang();
  const isTakeHome = sale.type === "TAKE_HOME";
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
                <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
                <path d="M9 8h6M9 12h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tnum">#{sale.number}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {formatDateTime(sale.createdAt)} · {sale.cashierName || "—"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tnum">
              <Money amount={sale.total} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {paymentLabelT(sale.paymentMethod, sale.paymentDetail, lang)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Pill tone={isTakeHome ? "warn" : "good"}>
            {isTakeHome ? t("sell.takeHome") : t("sell.eatHere")}
          </Pill>
          <span className="text-[11px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? t("common.item") : t("common.items")} · <Kg kg={sale.totalKg} />
          </span>
        </div>
      </button>
    </Card>
  );
}

