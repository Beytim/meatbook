"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { cn, formatBirr, formatDate, initials } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PeriodTabs, SearchInput, EmptyState, Pill, PageScaffold, ListSkeleton, Money, FilterSelect } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import type { PaymentMethod } from "@/lib/accounts";
import { useLang } from "@/components/lang-provider";
import { t as translate, type Lang } from "@/lib/i18n";

interface Debt {
  id: string;
  customerId: string;
  customer: { id: string; name: string; phone: string | null };
  amount: number;
  paid: number;
  balance: number;
  status: "OPEN" | "SETTLED";
  note: string | null;
  userName: string | null;
  createdAt: string;
  payments: { id: string; amount: number; paymentMethod: string; paymentDetail: string | null; note: string | null; createdAt: string }[];
}

function paymentLabelT(method: string, detail?: string | null, lang: Lang = "en"): string {
  if (method === "CASH") return translate("sell.cash", lang);
  if (method === "MOBILE") return `${translate("sell.mobile", lang)}${detail ? ` · ${detail}` : ""}`;
  if (method === "BANK") return `${translate("sell.bank", lang)}${detail ? ` · ${detail}` : ""}`;
  return method;
}

export function CustomerDebtsView() {
  const { back } = useNav();
  const { t, lang } = useLang();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"OPEN" | "SETTLED" | "ALL">("OPEN");
  const [addOpen, setAddOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["debts", filter],
    queryFn: async () => {
      const statusParam = filter === "ALL" ? "" : `?status=${filter}`;
      const r = await fetch(`/api/meat/debts${statusParam}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const debts: Debt[] = data?.debts ?? [];
  const filtered = q
    ? debts.filter((d) => d.customer.name.toLowerCase().includes(q.toLowerCase()) || d.note?.toLowerCase().includes(q.toLowerCase()))
    : debts;

  return (
    <PageScaffold
      title={t("debts.title")}
      subtitle={t("debts.subtitle")}
      onBack={() => back()}
      right={
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("debts.add")}
        </Button>
      }
    >
      {/* Outstanding total */}
      <Card className="mb-3 card-raised bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("debts.totalOutstanding")}</p>
            <p className="mt-0.5 text-xl font-bold tnum text-amber-400">{formatBirr(data?.totalOutstanding ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{debts.filter((d) => d.status === "OPEN").length} {t("debts.outstanding").toLowerCase()}</p>
          </div>
        </div>
      </Card>

      {/* Status filter — compact dropdown */}
      <div className="mb-3">
        <FilterSelect
          value={filter}
          onChange={(v) => setFilter(v as "OPEN" | "SETTLED" | "ALL")}
          options={[
            { value: "OPEN", label: t("debts.outstanding") },
            { value: "SETTLED", label: t("debts.settled") },
            { value: "ALL", label: t("debts.all") },
          ]}
        />
      </div>

      <SearchInput value={q} onChange={setQ} placeholder={`${t("common.search")}…`} className="mb-3" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></svg>}
          title={t("debts.empty")}
          description={t("debts.subtitle")}
          action={<Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">{t("debts.add")}</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DebtRow key={d.id} debt={d} lang={lang} />
          ))}
        </div>
      )}

      <AddDebtDialog open={addOpen} onOpenChange={setAddOpen} />
    </PageScaffold>
  );
}

function DebtRow({ debt, lang }: { debt: Debt; lang: Lang }) {
  const { t } = useLang();
  const [payOpen, setPayOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const isSettled = debt.status === "SETTLED";
  const pct = debt.amount > 0 ? Math.min(100, (debt.paid / debt.amount) * 100) : 0;

  return (
    <>
      <Card className="card-raised bg-card p-3">
        <button onClick={() => setDetailOpen(true)} className="block w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/10 text-xs font-bold text-amber-400">
                {initials(debt.customer.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{debt.customer.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{debt.note || formatDate(debt.createdAt)}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("text-sm font-bold tnum", isSettled ? "text-emerald-400" : "text-amber-400")}>
                {isSettled ? t("debts.settled") : formatBirr(debt.balance)}
              </p>
              <Pill tone={isSettled ? "good" : "warn"} className="mt-0.5">{isSettled ? t("debts.paid") : t("debts.outstanding")}</Pill>
            </div>
          </div>
          {/* Payment progress bar */}
          <div className="mt-2">
            <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground tnum">
              <span>{formatBirr(debt.paid)} {t("debts.paid").toLowerCase()}</span>
              <span>{t("debts.original").toLowerCase()} {formatBirr(debt.amount)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div className={cn("h-full rounded-full", isSettled ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </button>
        {!isSettled && (
          <button onClick={() => setPayOpen(true)} className="mt-2 w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-400 tap-scale">
            {t("debts.recordPayment")}
          </button>
        )}
      </Card>

      <PaymentDialog debt={debt} open={payOpen} onOpenChange={setPayOpen} lang={lang} />
      <DebtDetailDialog debt={debt} open={detailOpen} onOpenChange={setDetailOpen} lang={lang} />
    </>
  );
}

function PaymentDialog({ debt, open, onOpenChange, lang }: { debt: Debt; open: boolean; onOpenChange: (o: boolean) => void; lang: Lang }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("CASH");
  const [detail, setDetail] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => { if (open) { setAmount(String(debt.balance)); setMethod("CASH"); setDetail(""); setNote(""); } }, [open, debt.balance]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meat/debts/${debt.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), paymentMethod: method, paymentDetail: detail, note }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(t("debts.settledToast"));
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("debts.recordPayment")}</DialogTitle>
          <DialogDescription className="sr-only">{t("debts.recordPayment")} — {debt.customer.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-sm font-semibold">{debt.customer.name}</p>
            <p className="text-[11px] text-muted-foreground tnum">{t("debts.outstanding")}: {formatBirr(debt.balance)} / {formatBirr(debt.amount)}</p>
          </div>
          <div>
            <Label className="text-xs">{t("debts.paymentAmount")} (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 tnum text-lg" autoFocus />
          </div>
          <div>
            <Label className="text-xs">{t("sell.paymentMethod")}</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["CASH", "MOBILE", "BANK"] as PaymentMethod[]).map((m) => (
                <button key={m} type="button" onClick={() => { setMethod(m); setDetail(""); }}
                  className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", method === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {m === "CASH" ? t("sell.cash") : m === "MOBILE" ? t("sell.mobile") : t("sell.bank")}
                </button>
              ))}
            </div>
          </div>
          {method !== "CASH" && (
            <div><AccountProviderSelect method={method} value={detail} onChange={setDetail} /></div>
          )}
          <div>
            <Label className="text-xs">{t("debts.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !amount} className="bg-emerald-600 text-white">
            {save.isPending ? t("common.loading") : t("debts.recordPayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebtDetailDialog({ debt, open, onOpenChange, lang }: { debt: Debt; open: boolean; onOpenChange: (o: boolean) => void; lang: Lang }) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("debts.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("debts.title")} — {debt.customer.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-sm font-semibold">{debt.customer.name}</p>
            {debt.customer.phone && <p className="text-[11px] text-muted-foreground">{debt.customer.phone}</p>}
            {debt.note && <p className="mt-1 text-xs text-muted-foreground">{debt.note}</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(debt.createdAt)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">{t("debts.original")}</p>
              <p className="text-sm font-bold tnum"><Money amount={debt.amount} /></p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">{t("debts.paid")}</p>
              <p className="text-sm font-bold tnum text-emerald-400"><Money amount={debt.paid} /></p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">{t("debts.balance")}</p>
              <p className="text-sm font-bold tnum text-amber-400"><Money amount={debt.balance} /></p>
            </div>
          </div>
          {debt.payments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold">{t("debts.recordPayment")}</p>
              <div className="space-y-1">
                {debt.payments.map((p) => {
                  const methodLabel = paymentLabelT(p.paymentMethod, p.paymentDetail, lang);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-muted-foreground">{formatDate(p.createdAt)}</p>
                        <p className="mt-0.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {p.paymentMethod === "CASH" ? "💵" : p.paymentMethod === "MOBILE" ? "📱" : "🏦"} {methodLabel}
                          </span>
                          {p.note && <span className="truncate text-[10px] text-muted-foreground">{p.note}</span>}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tnum text-emerald-400">+{formatBirr(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDebtDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [customers, setCustomers] = React.useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [newCustomer, setNewCustomer] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) fetch("/api/meat/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      let custId = customerId;
      if (!custId && newCustomer.trim()) {
        const r = await fetch("/api/meat/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCustomer.trim() }) });
        const d = await r.json();
        custId = d.customer.id;
      }
      if (!custId) throw new Error("no customer");
      const r = await fetch("/api/meat/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: custId, amount: Number(amount), note }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(t("debts.added"));
      qc.invalidateQueries({ queryKey: ["debts"] });
      setCustomerId(""); setNewCustomer(""); setAmount(""); setNote("");
      onOpenChange(false);
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("debts.add")}</DialogTitle>
          <DialogDescription className="sr-only">{t("debts.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{t("debts.customerName")}</Label>
            {customers.length > 0 && (
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm focus:border-primary/50 focus:outline-none">
                <option value="">— {t("common.all")} —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <Input value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} placeholder="…" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t("debts.amount")} (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 tnum text-lg" />
          </div>
          <div>
            <Label className="text-xs">{t("debts.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (!customerId && !newCustomer.trim()) || !amount} className="bg-primary text-primary-foreground">
            {save.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
