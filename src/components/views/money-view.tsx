"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, cn, formatDateTime, type PeriodKey, periodLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PeriodTabs, EmptyState, Pill } from "@/components/app/primitives";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountTreeCard, type AccountTree } from "@/components/app/account-tree";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import { subAccountName, type PaymentMethod } from "@/lib/accounts";

interface MoneyData {
  accounts: { cash: number; mobile: number; bank: number };
  tree: { CASH: AccountTree; MOBILE: AccountTree; BANK: AccountTree };
  flow: { in: number; out: number; net: number };
  transactions: { id: string; kind: string; source: string; account: string; detail?: string | null; amount: number; reason: string; note?: string | null; userName: string | null; createdAt: string }[];
}

async function fetchMoney(period: PeriodKey): Promise<MoneyData> {
  const r = await fetch(`/api/meat/money?period=${period}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export function MoneyView() {
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [tab, setTab] = React.useState<"IN" | "OUT">("IN");
  const { data, isLoading } = useQuery({ queryKey: ["money", period], queryFn: () => fetchMoney(period) });
  const [moveOpen, setMoveOpen] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Money &amp; Cash Flow</h1>
        <p className="text-sm text-muted-foreground">Where every Birr came from and went</p>
      </div>

      {/* Cash on hand — tree breakdown by sub-account */}
      <div className="mb-2 px-1"><h2 className="text-base font-semibold">Cash on hand — all time</h2></div>
      <div className="mb-5 space-y-2.5">
        <AccountTreeCard method="CASH" label="Cash" tree={data?.tree.CASH ?? { total: 0, subAccounts: [] }} tone="emerald" defaultOpen />
        <AccountTreeCard method="MOBILE" label="Mobile Money" tree={data?.tree.MOBILE ?? { total: 0, subAccounts: [] }} tone="sky" defaultOpen />
        <AccountTreeCard method="BANK" label="Bank" tree={data?.tree.BANK ?? { total: 0, subAccounts: [] }} tone="violet" defaultOpen />
      </div>

      {/* Cash In / Out tabs */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button onClick={() => setTab("IN")} className={cn("rounded-xl py-2.5 text-sm font-bold tap-scale", tab === "IN" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-muted/60 text-muted-foreground")}>
          ↓ Cash In
        </button>
        <button onClick={() => setTab("OUT")} className={cn("rounded-xl py-2.5 text-sm font-bold tap-scale", tab === "OUT" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30" : "bg-muted/60 text-muted-foreground")}>
          ↑ Cash Out
        </button>
      </div>

      {/* Period tabs */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <PeriodTabs value={period} onChange={setPeriod} periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR", "ALL"]} />
        <Button size="sm" onClick={() => setMoveOpen(true)} className="shrink-0 bg-primary text-primary-foreground">
          {tab === "IN" ? "Add Cash In" : "Add Cash Out"}
        </Button>
      </div>

      {/* Flow summary */}
      {isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <FlowTile label="Money In" value={data?.flow.in ?? 0} tone="good" sub={periodLabel(period)} />
            <FlowTile label="Money Out" value={data?.flow.out ?? 0} tone="bad" sub={periodLabel(period)} />
            <FlowTile label="Net Cash Flow" value={data?.flow.net ?? 0} tone={((data?.flow.net ?? 0)) >= 0 ? "good" : "bad"} sub={periodLabel(period)} />
          </div>

          {/* Unified Transactions — sales + purchases + expenses + moves */}
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">All Transactions</h2>
            <span className="text-[10px] text-muted-foreground">{data?.transactions.length ?? 0} entries</span>
          </div>
          {data?.transactions.length === 0 ? (
            <EmptyState
              icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>}
              title="No transactions in this period."
              description="Sales, purchases, expenses, and manual moves will appear here."
              action={<Button onClick={() => setMoveOpen(true)} className="bg-primary text-primary-foreground">{tab === "IN" ? "Add Cash In" : "Add Cash Out"}</Button>}
            />
          ) : (
            <div className="mb-scroll max-h-[50vh] space-y-1 overflow-y-auto">
              {data?.transactions.map((t) => {
                const sourceColors: Record<string, string> = { "Sale": "bg-emerald-500/15 text-emerald-400", "Purchase": "bg-red-500/15 text-red-400", "Expense": "bg-amber-500/15 text-amber-400", "Manual": "bg-sky-500/15 text-sky-400" };
                const sourceBase = (t.source || "").split(" #")[0];
                const iconBg = sourceColors[sourceBase] || (t.kind === "IN" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400");
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-card/40 px-2.5 py-2">
                    <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-bold", iconBg)}>
                      {t.kind === "IN" ? "IN" : "OUT"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{t.source}: {t.reason}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {formatDateTime(t.createdAt)} · {t.account === "CASH" ? "Cash" : t.account === "MOBILE" ? "Mobile" : "Bank"}
                        {t.detail ? ` · ${subAccountName(t.account as PaymentMethod, t.detail)}` : ""}
                        {t.userName ? ` · ${t.userName}` : ""}
                      </p>
                    </div>
                    <p className={cn("shrink-0 text-xs font-bold tnum", t.kind === "IN" ? "text-emerald-400" : "text-red-400")}>
                      {t.kind === "IN" ? "+" : "−"}{formatBirr(Math.abs(t.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} direction={tab} period={period} />
    </div>
  );
}

function FlowTile({ label, value, tone, sub }: { label: string; value: number; tone: "good" | "bad"; sub: string }) {
  return (
    <Card className={cn("p-3 card-raised", tone === "good" ? "ring-1 ring-emerald-500/15" : "ring-1 ring-red-500/15")}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-bold tnum", tone === "good" ? (value >= 0 ? "text-emerald-400" : "text-red-400") : "text-red-400")}>{formatBirr(value)}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </Card>
  );
}

function MoveDialog({ open, onOpenChange, direction, period }: { open: boolean; onOpenChange: (o: boolean) => void; direction: "IN" | "OUT"; period: PeriodKey }) {
  const qc = useQueryClient();
  const [account, setAccount] = React.useState<"CASH" | "MOBILE" | "BANK">("CASH");
  const [detail, setDetail] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/money", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction, account, detail, amount: Number(amount), reason, note }) });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(direction === "IN" ? "Cash In recorded" : "Cash Out recorded");
      qc.invalidateQueries({ queryKey: ["money", period] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAmount(""); setReason(""); setNote(""); setDetail("");
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{direction === "IN" ? "Record Cash In" : "Record Cash Out"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Account</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["CASH", "MOBILE", "BANK"] as const).map((a) => (
                <button key={a} onClick={() => { setAccount(a); setDetail(""); }} className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", account === a ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {a === "CASH" ? "Cash" : a === "MOBILE" ? "Mobile" : "Bank"}
                </button>
              ))}
            </div>
          </div>
          {account !== "CASH" && (
            <div>
              <Label className="text-xs">{account === "MOBILE" ? "Provider" : "Bank"}</Label>
              <div className="mt-1">
                <AccountProviderSelect method={account} value={detail} onChange={setDetail} />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">Amount (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 tnum text-lg" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={direction === "IN" ? "e.g. Capital injection" : "e.g. Supplier payment"} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !amount} className="bg-primary text-primary-foreground">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
