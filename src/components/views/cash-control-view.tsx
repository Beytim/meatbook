"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatBirr, formatDateTime, formatDate, formatTime,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  EmptyState, Pill, PageScaffold, ListSkeleton, Money,
} from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface CashSession {
  id: string;
  opening: number;
  expected: number | null;
  counted: number | null;
  difference: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  openedBy: string | null;
  closedBy: string | null;
  note: string | null;
}
interface SessionsResp {
  sessions: CashSession[];
  open: (CashSession & { expected: number }) | null;
}

async function fetchSessions(): Promise<SessionsResp> {
  const r = await fetch("/api/meat/cash/sessions");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View (standalone — kept for backward compat) ──────────────────────
export function CashControlView() {
  const { back } = useNav();
  const { t } = useLang();
  return (
    <PageScaffold
      title={t("cashControl.title")}
      subtitle={t("cashControl.subtitle")}
      onBack={() => back()}
    >
      <CashDrawerSection />
    </PageScaffold>
  );
}

// ─── Cash Drawer Section (embedded in Money view) ───────────────────────
// Contains all cash-control logic: open/close drawer, session display,
// past sessions. Uses the same API, mutations, and invalidations.
export function CashDrawerSection() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [openDrawer, setOpenDrawer] = React.useState(false);
  const [closeDrawer, setCloseDrawer] = React.useState(false);
  const [justClosed, setJustClosed] = React.useState<CashSession | null>(null);

  const { data, isLoading } = useQuery<SessionsResp>({
    queryKey: ["cash-sessions"],
    queryFn: fetchSessions,
  });

  const open = data?.open ?? null;
  const closedSessions = (data?.sessions ?? []).filter((s) => s.status === "CLOSED");
  const allClosedSessions = justClosed && !closedSessions.find((s) => s.id === justClosed.id)
    ? [justClosed, ...closedSessions]
    : closedSessions;

  function handleCloseSuccess(session: CashSession) {
    setJustClosed(session);
    qc.invalidateQueries({ queryKey: ["cash-sessions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["money"] });
    setCloseDrawer(false);
  }

  function handleOpenSuccess() {
    qc.invalidateQueries({ queryKey: ["cash-sessions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["money"] });
    setOpenDrawer(false);
  }

  return (
    <>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : open ? (
        <>
          {/* Current open session card */}
          <Card className="mb-5 overflow-hidden card-raised">
            <div className="flex items-center justify-between border-b border-border/60 bg-emerald-500/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-semibold text-emerald-400">{t("cashControl.opened")}</span>
              </div>
              <Pill tone="good">{t("common.open")}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              <MetaCell label={t("common.date")} value={formatDateTime(open.openedAt)} />
              <MetaCell label={t("cashControl.opening")} value={formatBirr(open.opening)} tnum />
              <MetaCell label={t("cashControl.openedBy")} value={open.openedBy || "—"} />
              <MetaCell label={t("common.date")} value={formatDate(open.openedAt)} />
              <MetaCell label={t("cashControl.expected")} value={formatBirr(open.expected ?? 0)} tnum accent="emerald" />
              <MetaCell label={t("common.status")} value={t("cashControl.opened")} accent="emerald" />
            </div>
          </Card>

          {/* Close Cash Drawer section */}
          <Card className="mb-5 card-raised">
            <div className="p-4">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="13" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M14 15h3" />
                </svg>
                <h2 className="text-base font-semibold">{t("cashControl.closeDrawer")}</h2>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("cashControl.subtitle")}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <CloseStat label={t("cashControl.expected")} value={open.expected ?? 0} tone="default" />
                <CloseStat label={t("cashControl.counted")} value={null} tone="input" placeholder="0.00" />
                <CloseStat label={t("cashControl.difference")} value={null} tone="diff" placeholder="—" />
              </div>

              <Button
                onClick={() => setCloseDrawer(true)}
                className="mt-4 w-full bg-primary text-primary-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
                </svg>
                {t("cashControl.closeDrawer")}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <>
          {/* Open Cash Drawer section */}
          <Card className="mb-5 card-raised">
            <div className="p-4">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
                  <path d="M9 9l-2 3 2 3M15 9l2 3-2 3" />
                </svg>
                <h2 className="text-base font-semibold">{t("cashControl.openDrawer")}</h2>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("cashControl.subtitle")}
              </p>
              <Button
                onClick={() => setOpenDrawer(true)}
                className="mt-4 w-full bg-primary text-primary-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("cashControl.openDrawer")}
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* Just closed result */}
      {justClosed && (
        <Card className="mb-5 card-raised ring-1 ring-emerald-500/25">
          <div className="flex items-center gap-2 border-b border-border/60 bg-emerald-500/10 px-4 py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-sm font-semibold text-emerald-400">{t("cashControl.closed")}</span>
            <button
              onClick={() => setJustClosed(null)}
              className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <MetaCell label={t("cashControl.expected")} value={formatBirr(justClosed.expected ?? 0)} tnum />
            <MetaCell label={t("cashControl.counted")} value={formatBirr(justClosed.counted ?? 0)} tnum />
            <MetaCell
              label={t("cashControl.difference")}
              value={formatBirr(Math.abs(justClosed.difference ?? 0))}
              tone={diffTone(justClosed.difference ?? 0)}
              accent={diffAccent(justClosed.difference ?? 0)}
            />
            <MetaCell label={t("cashControl.closedBy")} value={justClosed.closedBy || "—"} />
          </div>
        </Card>
      )}

      {/* Past sessions */}
      <div className="mb-2 px-1">
        <h2 className="text-base font-semibold">{t("cashControl.pastSessions")}</h2>
        <p className="text-xs text-muted-foreground">{t("cashControl.subtitle")}</p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : allClosedSessions.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <path d="M7 15h4" />
            </svg>
          }
          title={t("cashControl.noSessions")}
          description={t("cashControl.subtitle")}
        />
      ) : (
        <div className="space-y-2.5">
          {allClosedSessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}

      <OpenDrawerDialog
        open={openDrawer}
        onOpenChange={setOpenDrawer}
        onSuccess={handleOpenSuccess}
      />
      <CloseDrawerDialog
        open={closeDrawer}
        onOpenChange={setCloseDrawer}
        expected={open?.expected ?? 0}
        onSuccess={handleCloseSuccess}
      />
    </>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function SessionRow({ session: s }: { session: CashSession }) {
  const { t } = useLang();
  const diff = s.difference ?? 0;
  return (
    <Card className="p-3.5 card-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <path d="M7 15h4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {formatDate(s.openedAt)} · {formatTime(s.openedAt)}
              <span className="text-muted-foreground"> → </span>
              {s.closedAt ? `${formatTime(s.closedAt)}` : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("cashControl.closedBy")} {s.closedBy || "—"}
            </p>
            {s.note && (
              <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                {s.note.includes("Transferred") ? "🏦" : "📝"} {s.note}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Pill tone="muted">{t("cashControl.opening")} {formatBirr(s.opening)}</Pill>
            <Pill tone={diffTone(diff)}>{diffLabel(diff)}</Pill>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground tnum">
            {t("cashControl.expected").toLowerCase()} <Money amount={s.expected ?? 0} /> · {t("cashControl.counted").toLowerCase()} <Money amount={s.counted ?? 0} />
          </p>
        </div>
      </div>
    </Card>
  );
}

// ─── Open Drawer Dialog ─────────────────────────────────────────────────
function OpenDrawerDialog({
  open, onOpenChange, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const { t } = useLang();
  const [opening, setOpening] = React.useState("");
  const [userName, setUserName] = React.useState("");

  const canOpen = !!opening && (parseFloat(opening) || 0) >= 0;

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN",
          opening: Number(opening) || 0,
          userName: userName.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || "failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(t("cashControl.openedToast"));
      setOpening("");
      setUserName("");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message || t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cashControl.openDrawer")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{t("cashControl.openAmount")} (Br)</Label>
            <Input
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 tnum text-lg"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("cashControl.subtitle")}
            </p>
          </div>
          <div>
            <Label className="text-xs">{t("cashControl.openedBy")}</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="…"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !canOpen}
            className="bg-primary text-primary-foreground"
          >
            {mut.isPending ? t("common.loading") : t("cashControl.openDrawer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close Drawer Dialog ────────────────────────────────────────────────
function CloseDrawerDialog({
  open, onOpenChange, expected, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expected: number;
  onSuccess: (session: CashSession) => void;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [counted, setCounted] = React.useState("");
  const [note, setNote] = React.useState("");
  const [userName, setUserName] = React.useState("");
  const [transferEnabled, setTransferEnabled] = React.useState(false);
  const [transferAmount, setTransferAmount] = React.useState("");
  const [transferTo, setTransferTo] = React.useState<"MOBILE" | "BANK">("BANK");
  const [transferDetail, setTransferDetail] = React.useState("");

  const countedN = parseFloat(counted) || 0;
  const diff = counted ? countedN - expected : 0;
  const transferN = parseFloat(transferAmount) || 0;

  const mut = useMutation({
    mutationFn: async () => {
      // If transfer is enabled, create a money move (OUT from CASH, IN to selected account)
      if (transferEnabled && transferN > 0) {
        await fetch("/api/meat/money", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "OUT", account: "CASH", amount: transferN,
            reason: `Cash drawer transfer to ${transferTo}`,
            userName: userName.trim() || "Abebe Owner",
          }),
        });
        await fetch("/api/meat/money", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "IN", account: transferTo, detail: transferDetail || undefined,
            amount: transferN,
            reason: `Cash drawer transfer`,
            userName: userName.trim() || "Abebe Owner",
          }),
        });
      }
      // Build note with transfer info if applicable
      const transferNote = transferEnabled && transferN > 0
        ? `Transferred ${formatBirr(transferN)} to ${transferTo}${transferDetail ? ` · ${transferDetail}` : ""}`
        : "";
      const fullNote = [note.trim(), transferNote].filter(Boolean).join(" | ") || undefined;
      // Close the drawer
      const r = await fetch("/api/meat/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          counted: countedN,
          note: fullNote,
          userName: userName.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || "failed");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(t("cashControl.closedToast"));
      if (transferEnabled && transferN > 0) {
        toast.success(`${formatBirr(transferN)} → ${transferTo}`);
      }
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      qc.invalidateQueries({ queryKey: ["cash-sessions"] });
      const session: CashSession = data.session;
      setCounted(""); setNote(""); setUserName("");
      setTransferEnabled(false); setTransferAmount(""); setTransferDetail("");
      onSuccess(session);
    },
    onError: (e: Error) => toast.error(e.message || t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("cashControl.closeDrawer")}</DialogTitle>
          <DialogDescription className="sr-only">{t("cashControl.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Expected */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("cashControl.expected")}</span>
            <span className="text-base font-bold tnum">{formatBirr(expected)}</span>
          </div>

          <div>
            <Label className="text-xs">{t("cashControl.countedAmount")} (Br)</Label>
            <Input
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 tnum text-lg"
              autoFocus
            />
          </div>

          {/* Difference live */}
          {counted ? (
            <div className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2.5 ring-1",
              diff === 0
                ? "bg-emerald-500/10 ring-emerald-500/25"
                : diff > 0
                ? "bg-emerald-500/10 ring-emerald-500/25"
                : "bg-red-500/10 ring-red-500/25",
            )}>
              <span className="text-xs font-medium text-muted-foreground">{t("cashControl.difference")}</span>
              <Pill tone={diffTone(diff)}>{diffLabel(diff)}</Pill>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">{t("cashControl.difference")}</span>
              <span className="text-sm font-semibold text-muted-foreground tnum">—</span>
            </div>
          )}

          {/* Transfer option */}
          <div className="rounded-lg border border-border/60 p-2.5">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={transferEnabled} onChange={(e) => setTransferEnabled(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <span className="text-xs font-semibold">{t("money.bank")} / {t("money.mobile")}</span>
            </label>
            {transferEnabled && (
              <div className="mt-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => { setTransferTo("BANK"); setTransferDetail(""); }}
                    className={cn("rounded-lg py-2 text-xs font-semibold", transferTo === "BANK" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                    🏦 {t("money.bank")}
                  </button>
                  <button type="button" onClick={() => { setTransferTo("MOBILE"); setTransferDetail(""); }}
                    className={cn("rounded-lg py-2 text-xs font-semibold", transferTo === "MOBILE" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                    📱 {t("money.mobile")}
                  </button>
                </div>
                <div>
                  <Label className="text-[10px]">{t("money.amount")} (Br)</Label>
                  <Input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-0.5 h-9 tnum text-sm" />
                </div>
                <div>
                  <Label className="text-[10px]">{transferTo === "MOBILE" ? t("sell.provider") : t("sell.bankLabel")}</Label>
                  <div className="mt-0.5">
                    <AccountProviderSelect method={transferTo} value={transferDetail} onChange={setTransferDetail} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">{t("cashControl.closedBy")}</Label>
            <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="…" className="mt-1" />
          </div>

          <div>
            <Label className="text-xs">{t("cashControl.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="…" className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !counted}
            className="bg-primary text-primary-foreground"
          >
            {mut.isPending ? t("common.loading") : t("cashControl.closeDrawer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────
function diffTone(diff: number): "good" | "bad" {
  if (diff === 0) return "good";
  return diff > 0 ? "good" : "bad";
}

function diffAccent(diff: number): "emerald" | "red" | undefined {
  if (diff === 0) return "emerald";
  return diff > 0 ? "emerald" : "red";
}

function diffLabel(diff: number): string {
  if (diff === 0) return "";
  if (diff > 0) return `+${formatBirr(diff)}`;
  return `−${formatBirr(Math.abs(diff))}`;
}

// ─── Small display pieces ───────────────────────────────────────────────
function MetaCell({
  label, value, tnum, tone, accent,
}: {
  label: string;
  value: string;
  tnum?: boolean;
  tone?: "good" | "bad";
  accent?: "emerald" | "red";
}) {
  const valueCls = tone === "good"
    ? "text-emerald-400"
    : tone === "bad"
    ? "text-red-400"
    : accent === "emerald"
    ? "text-emerald-400"
    : accent === "red"
    ? "text-red-400"
    : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate text-xs font-medium", valueCls, tnum && "tnum")}>{value}</p>
    </div>
  );
}

function CloseStat({
  label, value, tone, placeholder,
}: {
  label: string;
  value: number | null;
  tone: "default" | "input" | "diff";
  placeholder?: string;
}) {
  // input & diff tones are placeholders in the static display; only "Expected" has a value here
  const isAccent = tone === "input" || tone === "diff";
  return (
    <div className={cn(
      "rounded-lg p-2.5 ring-1",
      tone === "default"
        ? "bg-muted/40 ring-border/60"
        : "bg-card/40 ring-border/40",
    )}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-sm font-bold tnum",
        isAccent && "text-muted-foreground",
      )}>
        {value !== null ? formatBirr(value) : (placeholder || "—")}
      </p>
    </div>
  );
}
