"use client";

import { create } from "zustand";

export type ViewId =
  | "HOME"
  | "SELL"
  | "PRODUCTS"
  | "MONEY"
  | "SALES_HISTORY"
  | "PRODUCT_SALES"
  | "PURCHASES"
  | "WASTAGE"
  | "EXPENSES"
  | "CASH_CONTROL"
  | "RECEIPTS"
  | "REFUND_VOID"
  | "REPORTS"
  | "STAFF"
  | "AUDIT_LOG"
  | "BACKUP"
  | "DEVICE"
  | "LICENSE"
  | "SETTINGS";

interface NavState {
  view: ViewId;
  // optional payload for a view (e.g. sale id, product id)
  params: Record<string, string | number | undefined>;
  // navigation history for back button on sub-pages
  history: ViewId[];
  go: (view: ViewId, params?: Record<string, string | number | undefined>) => void;
  back: () => void;
  // primary nav highlight
  setPrimary: (view: ViewId) => void;
}

export const PRIMARY_VIEWS: ViewId[] = ["HOME", "SELL", "PRODUCTS", "MONEY"];

// maps each "more" view to which primary tab it belongs under (for highlight)
export const MORE_VIEWS: ViewId[] = [
  "SALES_HISTORY",
  "PRODUCT_SALES",
  "PURCHASES",
  "WASTAGE",
  "EXPENSES",
  "CASH_CONTROL",
  "RECEIPTS",
  "REFUND_VOID",
  "REPORTS",
  "STAFF",
  "AUDIT_LOG",
  "BACKUP",
  "DEVICE",
  "LICENSE",
  "SETTINGS",
];

export function isPrimary(view: ViewId): boolean {
  return PRIMARY_VIEWS.includes(view);
}

export const useNav = create<NavState>((set, get) => ({
  view: "HOME",
  params: {},
  history: [],
  go: (view, params = {}) => {
    const cur = get().view;
    set((s) => ({
      view,
      params,
      history: view === cur ? s.history : [...s.history, cur].slice(-20),
    }));
    // scroll content to top on navigation
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        const el = document.getElementById("app-scroll");
        if (el) el.scrollTo({ top: 0, behavior: "auto" });
      });
    }
  },
  back: () => {
    const hist = get().history;
    if (hist.length === 0) {
      set({ view: "HOME", params: {} });
      return;
    }
    const prev = hist[hist.length - 1];
    set((s) => ({ view: prev, params: {}, history: s.history.slice(0, -1) }));
  },
  setPrimary: (view) => set({ view, params: {}, history: [] }),
}));

// which primary tab should be highlighted for a given view
export function activePrimary(view: ViewId): ViewId {
  if (PRIMARY_VIEWS.includes(view)) return view;
  switch (view) {
    case "SALES_HISTORY":
    case "PRODUCT_SALES":
    case "REFUND_VOID":
    case "RECEIPTS":
    case "REPORTS":
      return "HOME";
    case "PURCHASES":
    case "WASTAGE":
    case "EXPENSES":
    case "CASH_CONTROL":
      return "MONEY";
    case "STAFF":
    case "AUDIT_LOG":
    case "BACKUP":
    case "DEVICE":
    case "LICENSE":
    case "SETTINGS":
      return "HOME";
    default:
      return "HOME";
  }
}
