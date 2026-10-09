"use client";

import * as React from "react";
import { cn, formatBirr, formatKg } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// ─── Stat tile ──────────────────────────────────────────────────────────
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "primary" | "good" | "warn" | "bad";
  icon?: React.ReactNode;
}) {
  const toneCls = {
    default: "bg-card text-card-foreground",
    primary: "bg-primary/10 text-foreground ring-1 ring-primary/25",
    good: "bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20",
    warn: "bg-amber-500/10 text-foreground ring-1 ring-amber-500/20",
    bad: "bg-red-500/10 text-foreground ring-1 ring-red-500/20",
  }[tone];
  return (
    <Card className={cn("relative overflow-hidden p-4 card-raised", toneCls)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-2 text-xl font-bold tnum tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ─── Section header ─────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Pill / tag ─────────────────────────────────────────────────────────
export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "primary" | "good" | "warn" | "bad" | "muted";
  className?: string;
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    good: "bg-emerald-500/15 text-emerald-400",
    warn: "bg-amber-500/15 text-amber-400",
    bad: "bg-red-500/15 text-red-400",
    muted: "bg-muted/60 text-muted-foreground",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones, className)}>
      {children}
    </span>
  );
}

// ─── Money display ──────────────────────────────────────────────────────
export function Money({ amount, currency = "Br", className, muted }: { amount: number; currency?: string; className?: string; muted?: boolean }) {
  return <span className={cn("tnum", muted && "text-muted-foreground", className)}>{formatBirr(amount, currency)}</span>;
}

export function Kg({ kg, className, muted }: { kg: number; className?: string; muted?: boolean }) {
  return <span className={cn("tnum", muted && "text-muted-foreground", className)}>{formatKg(kg)}</span>;
}

// ─── Period selector (compact dropdown) ─────────────────────────────────
import type { PeriodKey } from "@/lib/utils";
import { periodLabel } from "@/lib/utils";

const DEFAULT_PERIODS: PeriodKey[] = ["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR", "ALL"];

export function PeriodTabs({
  value,
  onChange,
  periods = DEFAULT_PERIODS,
  className,
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  periods?: PeriodKey[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PeriodKey)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border/60 bg-card/80 px-3 pr-9 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        {periods.map((p) => (
          <option key={p} value={p} className="bg-card text-foreground">{periodLabel(p)}</option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ─── Filter select (styled dropdown matching app theme) ──────────────────
export function FilterSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border/60 bg-card/80 px-3 pr-9 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">{o.label}</option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ─── Page scaffold for sub-views (with back button) ─────────────────────
export function PageScaffold({
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      {(onBack || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {onBack ? (
            <button onClick={onBack} className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground tap-scale">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </button>
          ) : <span />}
          {right}
        </div>
      )}
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Skeleton rows ──────────────────────────────────────────────────────
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── Search input ───────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border/70 bg-card/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      )}
    </div>
  );
}
