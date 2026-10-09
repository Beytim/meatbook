"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, cn, formatDateTime, type PeriodKey, periodLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PeriodTabs, EmptyState, Pill, FilterSelect } from "@/components/app/primitives";
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
import { useLang } from "@/components/lang-provider";

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
  const { t } = useLang();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [tab, setTab] = React.useState<"IN" | "OUT" | "ALL">("ALL");
  const [accountFilter, setAccountFilter] = React.useState<"ALL" | "CASH" | "MOBILE" | "BANK">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["money", period], queryFn: () => fetchMoney(period) });
  const [moveOpen, setMoveOpen] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("money.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("money.cashOnHandAllTime")}</p>
      </div>

      {/* Cash on hand — tree breakdown by sub-account */}
      <div className="mb-2 px-1"><h2 className="text-base font-semibold">{t("money.cashOnHandAllTime")}</h2></div>
      <div className="mb-5 space-y-2.5">
        <AccountTreeCard method="CASH" label={t("money.cash")} tree={data?.tree.CASH ?? { total: 0, subAccounts: [] }} tone="emerald" defaultOpen />
        <AccountTreeCard method="MOBILE" label={t("money.mobileMoney")} tree={data?.tree.MOBILE ?? { total: 0, subAccounts: [] }} tone="sky" defaultOpen />
        <AccountTreeCard method="BANK" label={t("money.bank")} tree={data?.tree.BANK ?? { total: 0, subAccounts: [] }} tone="violet" defaultOpen />
      </div>

      {/* Direction filter: All / In / Out */}
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <button onClick={() => setTab("ALL")} className={cn("rounded-lg py-2 text-xs font-bold tap-scale", tab === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>{t("common.all")}</button>
        <button onClick={() => setTab("IN")} className={cn("rounded-lg py-2 text-xs font-bold tap-scale", tab === "IN" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-muted/60 text-muted-foreground")}>↓ {t("money.moneyIn")}</button>
        <button onClick={() => setTab("OUT")} className={cn("rounded-lg py-2 text-xs font-bold tap-scale", tab === "OUT" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30" : "bg-muted/60 text-muted-foreground")}>↑ {t("money.moneyOut")}</button>
      </div>

      {/* Account filter: All / Cash / Mobile / Bank — compact dropdown */}
      <div className="mb-3">
        <FilterSelect
          value={accountFilter}
          onChange={(v) => setAccountFilter(v as "ALL" | "CASH" | "MOBILE" | "BANK")}
          options={[
            { value: "ALL", label: t("common.all") },
            { value: "CASH", label: `💵 ${t("money.cash")}` },
            { value: "MOBILE", label: `📱 ${t("money.mobile")}` },
            { value: "BANK", label: `🏦 ${t("money.bank")}` },
          ]}
        />
      </div>

      {/* Period tabs + Add button */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <PeriodTabs value={period} onChange={setPeriod} periods={["TODAY", "YESTERDAY", "7D", "30D", "MONTH", "YEAR", "ALL"]} />
        <Button size="sm" onClick={() => setMoveOpen(true)} className="shrink-0 bg-primary text-primary-foreground">
          {t("money.moneyIn")}/{t("money.moneyOut")}
        </Button>
      </div>

      {/* Flow summary */}
      {isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <FlowTile label={t("money.moneyIn")} value={data?.flow.in ?? 0} tone="good" sub={periodLabel(period)} />
            <FlowTile label={t("money.moneyOut")} value={data?.flow.out ?? 0} tone="bad" sub={periodLabel(period)} />
            <FlowTile label={t("money.netFlow")} value={data?.flow.net ?? 0} tone={((data?.flow.net ?? 0)) >= 0 ? "good" : "bad"} sub={periodLabel(period)} />
          </div>

          {/* Unified Transactions — filtered by direction + account */}
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("money.transactions")}</h2>
            <span className="text-[10px] text-muted-foreground">
              {(() => {
                const filtered = (data?.transactions ?? []).filter((tx) => {
                  if (tab !== "ALL" && tx.kind !== tab) return false;
                  if (accountFilter !== "ALL" && tx.account !== accountFilter) return false;
                  return true;
                });
                return filtered.length + " " + t("money.transactions").toLowerCase();
              })()}
            </span>
          </div>
          {(() => {
            const filtered = (data?.transactions ?? []).filter((tx) => {
              if (tab !== "ALL" && tx.kind !== tab) return false;
              if (accountFilter !== "ALL" && tx.account !== accountFilter) return false;
              return true;
            });
            if (filtered.length === 0) {
              return (
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>}
                  title={t("money.noTransactions")}
                  description={t("money.noTransactions")}
                  action={<Button onClick={() => setMoveOpen(true)} className="bg-primary text-primary-foreground">{t("money.moneyIn")}/{t("money.moneyOut")}</Button>}
                />
              );
            }
            return (
              <div className="mb-scroll max-h-[50vh] space-y-1 overflow-y-auto">
                {filtered.map((tx) => {
                  const sourceColors: Record<string, string> = { "Sale": "bg-emerald-500/15 text-emerald-400", "Purchase": "bg-red-500/15 text-red-400", "Expense": "bg-amber-500/15 text-amber-400", "Manual": "bg-sky-500/15 text-sky-400" };
                  const sourceBase = (tx.source || "").split(" #")[0];
                  const iconBg = sourceColors[sourceBase] || (tx.kind === "IN" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400");
                  return (
                    <div key={tx.id} className="flex items-center gap-2 rounded-lg bg-card/40 px-2.5 py-2">
                      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-bold", iconBg)}>
                        {tx.kind === "IN" ? t("common.in") : t("common.out")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{tx.source}: {tx.reason}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {formatDateTime(tx.createdAt)} · {tx.account === "CASH" ? t("money.cash") : tx.account === "MOBILE" ? t("money.mobile") : t("money.bank")}
                          {tx.detail ? ` · ${subAccountName(tx.account as PaymentMethod, tx.detail)}` : ""}
                          {tx.userName ? ` · ${tx.userName}` : ""}
                        </p>
                      </div>
                      <p className={cn("shrink-0 text-xs font-bold tnum", tx.kind === "IN" ? "text-emerald-400" : "text-red-400")}>
                        {tx.kind === "IN" ? "+" : "−"}{formatBirr(Math.abs(tx.amount))}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} direction={tab === "ALL" ? "IN" : tab} period={period} />
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
  const { t } = useLang();
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
      toast.success(direction === "IN" ? t("money.addCashIn") : t("money.addCashOut"));
      qc.invalidateQueries({ queryKey: ["money", period] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAmount(""); setReason(""); setNote(""); setDetail("");
      onOpenChange(false);
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{direction === "IN" ? t("money.addCashIn") : t("money.addCashOut")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{t("common.payment")}</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["CASH", "MOBILE", "BANK"] as const).map((a) => (
                <button key={a} onClick={() => { setAccount(a); setDetail(""); }} className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", account === a ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {a === "CASH" ? t("money.cash") : a === "MOBILE" ? t("money.mobile") : t("money.bank")}
                </button>
              ))}
            </div>
          </div>
          {account !== "CASH" && (
            <div>
              <Label className="text-xs">{account === "MOBILE" ? t("sell.provider") : t("sell.bankLabel")}</Label>
              <div className="mt-1">
                <AccountProviderSelect method={account} value={detail} onChange={setDetail} />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">{t("money.amount")} (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 tnum text-lg" autoFocus />
          </div>
          <div>
            <Label className="text-xs">{t("wastage.reason")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="…" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t("money.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !amount} className="bg-primary text-primary-foreground">
            {save.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
