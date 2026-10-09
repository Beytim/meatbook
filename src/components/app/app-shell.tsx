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
// Purchases + Wastage are also static — lazy-loading them caused OOM spikes
// when Turbopack compiled their chunks on-demand under the 4GB cgroup limit.
import { PurchasesView } from "@/components/views/purchases-view";
import { WastageView } from "@/components/views/wastage-view";
import { CustomerDebtsView } from "@/components/views/customer-debts-view";
import { SupplierLedgerView } from "@/components/views/supplier-ledger-view";

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
  PURCHASES: PurchasesView,
  WASTAGE: WastageView,
  CUSTOMER_DEBTS: CustomerDebtsView,
  SUPPLIER_LEDGER: SupplierLedgerView,
  EXPENSES: dynamic(() => import("@/components/views/expenses-view").then((m) => m.ExpensesView), { loading }),
  REPORTS: dynamic(() => import("@/components/views/reports-view").then((m) => m.ReportsView), { loading }),
  STAFF: dynamic(() => import("@/components/views/staff-view").then((m) => m.StaffView), { loading }),
  AUDIT_LOG: dynamic(() => import("@/components/views/audit-log-view").then((m) => m.AuditLogView), { loading }),
  BACKUP: dynamic(() => import("@/components/views/backup-view").then((m) => m.BackupView), { loading }),
  LICENSE: dynamic(() => import("@/components/views/license-view").then((m) => m.LicenseView), { loading }),
  SETTINGS: dynamic(() => import("@/components/views/settings-view").then((m) => m.SettingsView), { loading }),
};

// Error boundary: if a view fails to load (chunk error / runtime error),
// show a retry button instead of crashing the whole app or redirecting.
class ViewErrorBoundary extends React.Component<
  { children: React.ReactNode; retryKey: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; retryKey: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { retryKey: string }) {
    // reset error when view changes
    if (prevProps.retryKey !== this.props.retryKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-16 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4 M12 17h.01" /></svg>
          </div>
          <p className="text-sm font-semibold">Couldn&apos;t load this screen</p>
          <p className="mt-1 text-xs text-muted-foreground">The dev server may be compiling. Try again.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground tap-scale"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppShell() {
  const view = useNav((s) => s.view);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const Current = VIEW_MAP[view] ?? VIEW_MAP.HOME;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background grain">
      <TopBar />
      <main id="app-scroll" className="mb-scroll flex-1 overflow-y-auto">
        <ViewErrorBoundary retryKey={view}>
          <React.Suspense fallback={loading()}>
            <Current />
          </React.Suspense>
        </ViewErrorBoundary>
      </main>
      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
