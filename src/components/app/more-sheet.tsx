"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useNav, type ViewId } from "@/lib/nav";
import { BrandMark } from "@/components/brand";
import { useLang } from "@/components/lang-provider";

// Group/item data holds translation keys; the component resolves them via `t()`.
const MORE_GROUPS: { titleKey: string; items: { id: ViewId; labelKey: string; icon: React.ReactNode; descKey: string }[] }[] = [
  {
    titleKey: "more.salesRecords",
    items: [
      { id: "SALES_HISTORY", labelKey: "salesHistory.title", descKey: "salesHistory.subtitle", icon: <Ico path="M3 3v18h18 M7 14l3-3 3 2 4-5" /> },
      { id: "PRODUCT_SALES", labelKey: "home.productSales", descKey: "home.productSales", icon: <Ico path="M4 20V10 M10 20V4 M16 20v-7 M22 20H2" /> },
      { id: "RECEIPTS", labelKey: "receipts.title", descKey: "receipts.subtitle", icon: <Ico path="M6 2h9l4 4v16H6z M9 9h7 M9 13h7 M9 17h4" /> },
      { id: "REFUND_VOID", labelKey: "refundVoid.title", descKey: "refundVoid.subtitle", icon: <Ico path="M3 7v6h6 M3 13a9 9 0 1 0 3-7" /> },
    ],
  },
  {
    titleKey: "more.moneyStock",
    items: [
      { id: "PURCHASES", labelKey: "purchases.title", descKey: "purchases.subtitle", icon: <Ico path="M3 3v18h18 M7 10l3 3 4-5" /> },
      { id: "WASTAGE", labelKey: "home.wastage", descKey: "wastage.subtitle", icon: <Ico path="M5 5l14 14 M16 5a3.5 3.5 0 0 1 0 5l-5 5a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0z" /> },
      { id: "EXPENSES", labelKey: "expenses.title", descKey: "expenses.subtitle", icon: <Ico path="M2 7h20v12H2z M2 11h20 M16 15h2" /> },
      { id: "CASH_CONTROL", labelKey: "cashControl.title", descKey: "cashControl.subtitle", icon: <Ico path="M3 7h18v12H3z M3 11h18 M8 15h3" /> },
      { id: "CUSTOMER_DEBTS", labelKey: "debts.title", descKey: "debts.subtitle", icon: <Ico path="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M23 21v-2a4 4 0 0 0-3-3.8 M16 3.1a3.5 3.5 0 0 1 0 6.8" /> },
      { id: "SUPPLIER_LEDGER", labelKey: "suppliers.title", descKey: "suppliers.subtitle", icon: <Ico path="M4 4v16h16V4z M8 10h8 M8 14h6 M8 7h8" /> },
    ],
  },
  {
    titleKey: "more.insights",
    items: [
      { id: "REPORTS", labelKey: "reports.title", descKey: "reports.title", icon: <Ico path="M4 20V4 M4 20h16 M8 16v-4 M12 16V8 M16 16v-7" /> },
      { id: "AUDIT_LOG", labelKey: "audit.title", descKey: "audit.subtitle", icon: <Ico path="M12 8v4l3 2 M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" /> },
    ],
  },
  {
    titleKey: "more.system",
    items: [
      { id: "STAFF", labelKey: "staff.title", descKey: "staff.subtitle", icon: <Ico path="M16 19v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M17 11a3 3 0 1 0 0-6 M22 19v-2a4 4 0 0 0-3-3.8" /> },
      { id: "BACKUP", labelKey: "backup.title", descKey: "backup.subtitle", icon: <Ico path="M4 4v16h16V4z M12 8v8 M8 12l4-4 4 4" /> },
      { id: "DEVICE", labelKey: "device.title", descKey: "device.title", icon: <Ico path="M2 5h20v12H2z M2 21h20 M8 17v4 M16 17v4" /> },
      { id: "LICENSE", labelKey: "license.title", descKey: "license.title", icon: <Ico path="M4 4v16h16V4z M9 12l2 2 4-4" /> },
      { id: "SETTINGS", labelKey: "settings.title", descKey: "settings.title", icon: <Ico path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-5l-.3 2a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2h5l.3-2a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /> },
    ],
  },
];

function Ico({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d={path} />
    </svg>
  );
}

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const go = useNav((s) => s.go);
  const current = useNav((s) => s.view);
  const { t } = useLang();

  const navigate = (id: ViewId) => {
    onOpenChange(false);
    go(id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88vh] flex-col gap-0 rounded-t-3xl border-border/70 bg-background p-0">
        <SheetHeader className="border-b border-border/60 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <BrandMark size="md" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Offline
              </div>
            </div>
          </div>
          <SheetTitle className="sr-only">More menu</SheetTitle>
        </SheetHeader>

        <div className="mb-scroll flex-1 overflow-y-auto px-3 py-3">
          {MORE_GROUPS.map((group) => (
            <div key={group.titleKey} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t(group.titleKey)}</p>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
                {group.items.map((item, i) => {
                  const isActive = current === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        i > 0 && "border-t border-border/40",
                        isActive && "bg-primary/10"
                      )}
                    >
                      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", isActive ? "bg-primary text-primary-foreground" : "bg-muted/70 text-foreground")}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{t(item.labelKey)}</span>
                        <span className="block text-[11px] text-muted-foreground">{t(item.descKey)}</span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="px-2 pb-4 pt-2 text-center text-[10px] text-muted-foreground">
            MeatBook · Charcoal + Meat Red · Offline-first
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
