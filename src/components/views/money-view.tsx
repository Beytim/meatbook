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

interface MoneyData {
  accounts: { cash: number; mobile: number; bank: number };
  flow: { in: number; out: number; net: number };
  transactions: { id: string; kind: string; account: string; amount: number; reason: string | null; note: string | null; userName: string | null; createdAt: string }[];
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

      {/* Cash on hand */}
      <div className="mb-2 px-1"><h2 className="text-base font-semibold">Cash on hand — all time</h2></div>
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <AccountTile label="Cash" amount={data?.accounts.cash ?? 0} tone="emerald" />
        <AccountTile label="Mobile Money" amount={data?.accounts.mobile ?? 0} tone="sky" />
        <AccountTile label="Bank" amount={data?.accounts.bank ?? 0} tone="violet" />
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

          {/* Transactions */}
          <h2 className="mb-2 px-1 text-base font-semibold">Transactions</h2>
          {data?.transactions.length === 0 ? (
            <EmptyState
              icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>}
              title="No money movements in this period."
              description="Try a wider period or record a manual Cash In / Cash Out."
              action={<Button onClick={() => setMoveOpen(true)} className="bg-primary text-primary-foreground">{tab === "IN" ? "Add Cash In" : "Add Cash Out"}</Button>}
            />
          ) : (
            <div className="space-y-2">
              {data?.transactions.map((t) => (
                <Card key={t.id} className="flex items-center gap-3 p-3 card-raised">
                  <div className={cn("grid h-10 w-10 place-items-center rounded-xl", t.kind === "IN" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      {t.kind === "IN" ? <path d="M12 19V5 M5 12l7-7 7 7" /> : <path d="M12 5v14 M19 12l-7 7-7-7" />}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.reason || (t.kind === "IN" ? "Cash In" : "Cash Out")}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(t.createdAt)} · {t.account.toLowerCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold tnum", t.kind === "IN" ? "text-emerald-400" : "text-red-400")}>{t.kind === "IN" ? "+" : "−"}{formatBirr(Math.abs(t.amount))}</p>
                    <Pill tone="muted" className="mt-0.5">{t.account}</Pill>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} direction={tab} period={period} />
    </div>
  );
}

function AccountTile({ label, amount, tone }: { label: string; amount: number; tone: "emerald" | "sky" | "violet" }) {
  const tones = {
    emerald: "from-emerald-500/15 to-emerald-500/5 ring-emerald-500/20 text-emerald-400",
    sky: "from-sky-500/15 to-sky-500/5 ring-sky-500/20 text-sky-400",
    violet: "from-violet-500/15 to-violet-500/5 ring-violet-500/20 text-violet-400",
  }[tone];
  return (
    <Card className={cn("bg-gradient-to-br p-3 ring-1", tones)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className={cn("mt-1 text-sm font-bold tnum tracking-tight", amount < 0 && "text-red-400")}>{formatBirr(amount)}</p>
    </Card>
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
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/money", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction, account, amount: Number(amount), reason, note }) });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(direction === "IN" ? "Cash In recorded" : "Cash Out recorded");
      qc.invalidateQueries({ queryKey: ["money", period] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAmount(""); setReason(""); setNote("");
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
                <button key={a} onClick={() => setAccount(a)} className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", account === a ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {a === "CASH" ? "Cash" : a === "MOBILE" ? "Mobile" : "Bank"}
                </button>
              ))}
            </div>
          </div>
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
