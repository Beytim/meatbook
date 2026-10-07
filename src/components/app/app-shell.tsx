"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { MoreSheet } from "./more-sheet";
import { useNav } from "@/lib/nav";
import type { ViewId } from "@/lib/nav";
// Primary views are statically imported (compile with the main bundle, curl-warmable).
import { HomeView } from "@/components/views/home-view";
import { SellView } from "@/components/views/sell-view";
import { ProductsView } from "@/components/views/products-view";
import { MoneyView } from "@/components/views/money-view";

// Secondary ("More") views are lazy-loaded to keep memory low under the cgroup limit.
const loading = () => (
  <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-10 text-center text-sm text-muted-foreground">
    <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    Loading…
  </div>
);

const VIEW_MAP: Record<ViewId, React.ComponentType> = {
  HOME: HomeView,
  SELL: SellView,
  PRODUCTS: ProductsView,
  MONEY: MoneyView,
  SALES_HISTORY: dynamic(() => import("@/components/views/sales-history-view").then((m) => m.SalesHistoryView), { loading }),
  PRODUCT_SALES: dynamic(() => import("@/components/views/product-sales-view").then((m) => m.ProductSalesView), { loading }),
  PURCHASES: dynamic(() => import("@/components/views/purchases-view").then((m) => m.PurchasesView), { loading }),
  WASTAGE: dynamic(() => import("@/components/views/wastage-view").then((m) => m.WastageView), { loading }),
  EXPENSES: dynamic(() => import("@/components/views/expenses-view").then((m) => m.ExpensesView), { loading }),
  CASH_CONTROL: dynamic(() => import("@/components/views/cash-control-view").then((m) => m.CashControlView), { loading }),
  RECEIPTS: dynamic(() => import("@/components/views/receipts-view").then((m) => m.ReceiptsView), { loading }),
  REFUND_VOID: dynamic(() => import("@/components/views/refund-void-view").then((m) => m.RefundVoidView), { loading }),
  REPORTS: dynamic(() => import("@/components/views/reports-view").then((m) => m.ReportsView), { loading }),
  STAFF: dynamic(() => import("@/components/views/staff-view").then((m) => m.StaffView), { loading }),
  AUDIT_LOG: dynamic(() => import("@/components/views/audit-log-view").then((m) => m.AuditLogView), { loading }),
  BACKUP: dynamic(() => import("@/components/views/backup-view").then((m) => m.BackupView), { loading }),
  DEVICE: dynamic(() => import("@/components/views/device-view").then((m) => m.DeviceView), { loading }),
  LICENSE: dynamic(() => import("@/components/views/license-view").then((m) => m.LicenseView), { loading }),
  SETTINGS: dynamic(() => import("@/components/views/settings-view").then((m) => m.SettingsView), { loading }),
};

export function AppShell() {
  const view = useNav((s) => s.view);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const Current = VIEW_MAP[view] ?? VIEW_MAP.HOME;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background grain">
      <TopBar />
      <main id="app-scroll" className="mb-scroll flex-1 overflow-y-auto">
        <React.Suspense fallback={loading()}>
          <Current />
        </React.Suspense>
      </main>
      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
