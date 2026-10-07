"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatTime, relativeDay, formatDate,
  type PeriodKey,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PeriodTabs, SearchInput, EmptyState, Pill,
  PageScaffold, ListSkeleton,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
interface AuditEvent {
  id: string;
  action: string;
  description: string | null;
  userId: string | null;
  userName: string | null;
  meta: string | null;
  createdAt: string;
}

interface AuditResp { events: AuditEvent[]; count: number }

// ─── Action classification ──────────────────────────────────────────────
type Tone = "good" | "sky" | "bad" | "warn" | "violet" | "muted";

function classifyAction(action: string): { tone: Tone; icon: React.ReactNode; label: string } {
  const a = (action || "").toUpperCase();
  let tone: Tone = "muted";
  let iconKind: "create" | "update" | "delete" | "void" | "refund" | "open" | "close" | "other" = "other";

  if (a.includes("CREATE")) { tone = "good"; iconKind = "create"; }
  else if (a.includes("DELETE")) { tone = "bad"; iconKind = "delete"; }
  else if (a.includes("VOID")) { tone = "bad"; iconKind = "void"; }
  else if (a.includes("REFUND")) { tone = "warn"; iconKind = "refund"; }
  else if (a.includes("UPDATE")) { tone = "sky"; iconKind = "update"; }
  else if (a.includes("OPEN")) { tone = "violet"; iconKind = "open"; }
  else if (a.includes("CLOSE")) { tone = "violet"; iconKind = "close"; }

  const icon = renderIcon(iconKind);
  const label = prettyLabel(a);
  return { tone, icon, label };
}

function prettyLabel(a: string): string {
  const map: Record<string, string> = {
    SALE_CREATE: "Sale Created",
    SALE_VOID: "Sale Voided",
    SALE_REFUND: "Sale Refunded",
    PURCHASE_CREATE: "Purchase Recorded",
    WASTAGE_CREATE: "Wastage Recorded",
    EXPENSE_CREATE: "Expense Recorded",
    MONEY_IN: "Cash In",
    MONEY_OUT: "Cash Out",
    PRODUCT_CREATE: "Product Created",
    PRODUCT_UPDATE: "Product Updated",
    PRODUCT_DELETE: "Product Deleted",
    STAFF_CREATE: "Staff Added",
    STAFF_UPDATE: "Staff Updated",
    STAFF_DELETE: "Staff Removed",
    CASH_OPEN: "Cash Opened",
    CASH_CLOSE: "Cash Closed",
    SETTINGS_UPDATE: "Settings Updated",
    BACKUP_CREATE: "Backup Created",
  };
  if (map[a]) return map[a];
  // Fallback: turn SNAKE_CASE into Title Case
  return a
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderIcon(kind: "create" | "update" | "delete" | "void" | "refund" | "open" | "close" | "other") {
  const common = "h-4 w-4";
  switch (kind) {
    case "create":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "update":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "delete":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      );
    case "void":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" />
        </svg>
      );
    case "refund":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" />
        </svg>
      );
    case "open":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" />
        </svg>
      );
  }
}

const TONE_CLS: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
  sky: "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25",
  bad: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
  warn: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  violet: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25",
  muted: "bg-muted/70 text-muted-foreground ring-1 ring-border/60",
};
const TONE_PILL: Record<Tone, "good" | "warn" | "bad" | "muted" | "primary"> = {
  good: "good",
  sky: "primary",
  bad: "bad",
  warn: "warn",
  violet: "primary",
  muted: "muted",
};

// ─── Helpers ────────────────────────────────────────────────────────────
async function fetchAudit(period: PeriodKey, q: string): Promise<AuditResp> {
  const r = await fetch(`/api/meat/audit?period=${period}&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

function dayKey(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}
function dayHeader(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(date);
}

// ─── View ───────────────────────────────────────────────────────────────
export function AuditLogView() {
  const { back } = useNav();
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

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const isCustom = period === "CUSTOM";
  const queryKey = isCustom
    ? ["audit", "CUSTOM", customFrom, customTo, debouncedQ]
    : ["audit", period, debouncedQ];

  const { data, isLoading } = useQuery<AuditResp>({
    queryKey,
    queryFn: async () => {
      if (isCustom) {
        // API doesn't support from/to; fetch ALL and filter client-side
        const r = await fetch(`/api/meat/audit?period=ALL&q=${encodeURIComponent(debouncedQ)}`);
        if (!r.ok) throw new Error("failed");
        const j: AuditResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        const events = j.events.filter((e) => {
          const c = new Date(e.createdAt);
          return c >= fromD && c <= toD;
        });
        return { events, count: events.length };
      }
      return fetchAudit(period, debouncedQ);
    },
  });

  const events = data?.events ?? [];

  // Group events by day
  const grouped = React.useMemo(() => {
    const m = new Map<string, AuditEvent[]>();
    for (const e of events) {
      const k = dayKey(e.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries());
  }, [events]);

  return (
    <PageScaffold
      title="Audit Log"
      subtitle="Every important action, recorded."
      onBack={() => back()}
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "CUSTOM"]}
        />
      </div>

      {isCustom && (
        <Card className="mb-4 grid grid-cols-2 gap-3 p-3 card-raised">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 tnum"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
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
        placeholder="Search by action or description…"
        className="mb-3"
      />

      <p className="mb-3 px-1 text-xs text-muted-foreground">
        Showing <span className="tnum font-semibold text-foreground">{events.length}</span>{" "}
        {events.length === 1 ? "event" : "events"}
      </p>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /><path d="M3 12h2M19 12h2" />
            </svg>
          }
          title="No audit events in this period."
          description="Try a wider date range, or check back after activity happens."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur">
                <span className="rounded-full bg-muted/70 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {dayHeader(items[0].createdAt)}
                </span>
                <span className="text-[11px] text-muted-foreground tnum">{items.length} {items.length === 1 ? "event" : "events"}</span>
              </div>
              <div className="relative space-y-2 pl-5">
                {/* Vertical timeline line */}
                <div className="absolute left-[14px] top-2 bottom-2 w-px bg-border/60" />
                {items.map((e) => (
                  <AuditRow key={e.id} event={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function AuditRow({ event }: { event: AuditEvent }) {
  const { tone, icon, label } = classifyAction(event.action);
  return (
    <Card className="relative overflow-hidden p-3 card-raised">
      {/* Icon dot on the timeline */}
      <div
        className={cn(
          "absolute -left-[19px] top-4 grid h-7 w-7 place-items-center rounded-full ring-2 ring-background",
          TONE_CLS[tone],
        )}
      >
        {icon}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{label}</p>
            <Pill tone={TONE_PILL[tone]}>{event.action}</Pill>
          </div>
          {event.description && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{event.description}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            by <span className="font-medium text-foreground/80">{event.userName || "System"}</span>
            {" · "}{relativeDay(event.createdAt)} at {formatTime(event.createdAt)}
          </p>
        </div>
      </div>
    </Card>
  );
}
