import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Money / number formatting ─────────────────────────────────────────
// Birr is the currency. Format with thousands separators and 2 decimals.
export function formatBirr(amount: number | null | undefined, currency = "Br"): string {
  const v = Number(amount ?? 0);
  const neg = v < 0;
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? "-" : ""}${currency} ${formatted}`;
}

// compact birr for chart axis: 3.0k
export function formatBirrCompact(amount: number | null | undefined, currency = "Br"): string {
  const v = Number(amount ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return v.toFixed(0);
}

export function formatKg(kg: number | null | undefined): string {
  const v = Number(kg ?? 0);
  return `${v.toFixed(2)} kg`;
}

export function formatCount(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-US");
}

// ─── Date helpers ──────────────────────────────────────────────────────
export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function relativeDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((today - that) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}

export type PeriodKey =
  | "TODAY"
  | "YESTERDAY"
  | "7D"
  | "30D"
  | "MONTH"
  | "YEAR"
  | "ALL"
  | "CUSTOM";

export interface DateRange {
  from: Date;
  to: Date;
}

export function periodRange(period: PeriodKey): DateRange {
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  switch (period) {
    case "TODAY":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "YESTERDAY":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      break;
    case "7D":
      from = new Date(now.getTime() - 6 * 86400000);
      from = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      break;
    case "30D":
      from = new Date(now.getTime() - 29 * 86400000);
      from = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      break;
    case "MONTH":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "YEAR":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "ALL":
      from = new Date(2000, 0, 1);
      break;
    case "CUSTOM":
      break;
  }
  return { from, to };
}

export function periodLabel(period: PeriodKey): string {
  switch (period) {
    case "TODAY": return "Today";
    case "YESTERDAY": return "Yesterday";
    case "7D": return "7 Days";
    case "30D": return "30 Days";
    case "MONTH": return "This Month";
    case "YEAR": return "This Year";
    case "ALL": return "All";
    case "CUSTOM": return "Custom";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic accent color from a string (for product tiles)
export function colorFromString(str: string): string {
  const colors = [
    "from-rose-500/20 to-rose-600/10 text-rose-300",
    "from-amber-500/20 to-amber-600/10 text-amber-300",
    "from-orange-500/20 to-orange-600/10 text-orange-300",
    "from-red-500/20 to-red-600/10 text-red-300",
    "from-stone-400/20 to-stone-500/10 text-stone-300",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
