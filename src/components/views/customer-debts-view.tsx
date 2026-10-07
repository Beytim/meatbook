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
import { PeriodTabs, SearchInput, EmptyState, Pill, PageScaffold, ListSkeleton, Money } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import type { PaymentMethod } from "@/lib/accounts";

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

export function CustomerDebtsView() {
  const { back } = useNav();
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
      title="Customer Debts"
      subtitle="Money owed to the shop by customers"
      onBack={() => back()}
      right={
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Debt
        </Button>
      }
    >
      {/* Outstanding total */}
      <Card className="mb-3 card-raised bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Outstanding</p>
            <p className="mt-0.5 text-xl font-bold tnum text-amber-400">{formatBirr(data?.totalOutstanding ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{debts.filter((d) => d.status === "OPEN").length} open debts</p>
          </div>
        </div>
      </Card>

      {/* Filter tabs */}
      <div className="mb-3 flex gap-1.5">
        {(["OPEN", "SETTLED", "ALL"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold tap-scale", filter === f ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            {f === "OPEN" ? "Outstanding" : f === "SETTLED" ? "Settled" : "All"}
          </button>
        ))}
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Search customer or note…" className="mb-3" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></svg>}
          title="No debts"
          description="Record a debt when a customer takes meat on credit."
          action={<Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">Add Debt</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DebtRow key={d.id} debt={d} />
          ))}
        </div>
      )}

      <AddDebtDialog open={addOpen} onOpenChange={setAddOpen} />
    </PageScaffold>
  );
}

function DebtRow({ debt }: { debt: Debt }) {
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
                {isSettled ? "Settled" : formatBirr(debt.balance)}
              </p>
              <Pill tone={isSettled ? "good" : "warn"} className="mt-0.5">{isSettled ? "Paid" : "Outstanding"}</Pill>
            </div>
          </div>
          {/* Payment progress bar */}
          <div className="mt-2">
            <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground tnum">
              <span>{formatBirr(debt.paid)} paid</span>
              <span>of {formatBirr(debt.amount)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div className={cn("h-full rounded-full", isSettled ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </button>
        {!isSettled && (
          <button onClick={() => setPayOpen(true)} className="mt-2 w-full rounded-lg bg-emerald-500/15 py-2 text-xs font-semibold text-emerald-400 tap-scale">
            Record Payment
          </button>
        )}
      </Card>

      <PaymentDialog debt={debt} open={payOpen} onOpenChange={setPayOpen} />
      <DebtDetailDialog debt={debt} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

function PaymentDialog({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (o: boolean) => void }) {
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
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Could not record payment"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription className="sr-only">Record a debt payment from {debt.customer.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl bg-muted/40 p-2.5">
            <p className="text-sm font-semibold">{debt.customer.name}</p>
            <p className="text-[11px] text-muted-foreground tnum">Outstanding: {formatBirr(debt.balance)} of {formatBirr(debt.amount)}</p>
          </div>
          <div>
            <Label className="text-xs">Amount (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 tnum text-lg" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Payment method</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["CASH", "MOBILE", "BANK"] as PaymentMethod[]).map((m) => (
                <button key={m} type="button" onClick={() => { setMethod(m); setDetail(""); }}
                  className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", method === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile" : "Bank"}
                </button>
              ))}
            </div>
          </div>
          {method !== "CASH" && (
            <div><AccountProviderSelect method={method} value={detail} onChange={setDetail} /></div>
          )}
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !amount} className="bg-emerald-600 text-white">
            {save.isPending ? "Saving…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebtDetailDialog({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Debt Details</DialogTitle>
          <DialogDescription className="sr-only">Debt details and payment history for {debt.customer.name}.</DialogDescription>
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
              <p className="text-[10px] text-muted-foreground">Original</p>
              <p className="text-sm font-bold tnum"><Money amount={debt.amount} /></p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">Paid</p>
              <p className="text-sm font-bold tnum text-emerald-400"><Money amount={debt.paid} /></p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">Balance</p>
              <p className="text-sm font-bold tnum text-amber-400"><Money amount={debt.balance} /></p>
            </div>
          </div>
          {debt.payments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold">Payment History</p>
              <div className="space-y-1">
                {debt.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-1.5 text-xs">
                    <span className="text-muted-foreground">{formatDate(p.createdAt)}</span>
                    <span className="font-semibold tnum text-emerald-400">+{formatBirr(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDebtDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
      toast.success("Debt recorded");
      qc.invalidateQueries({ queryKey: ["debts"] });
      setCustomerId(""); setNewCustomer(""); setAmount(""); setNote("");
      onOpenChange(false);
    },
    onError: () => toast.error("Could not record debt"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Debt</DialogTitle>
          <DialogDescription className="sr-only">Record a new customer debt.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Customer</Label>
            {customers.length > 0 && (
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm focus:border-primary/50 focus:outline-none">
                <option value="">— Select existing —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <Input value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} placeholder="…or type a new customer name" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Amount (Br)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 tnum text-lg" />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (!customerId && !newCustomer.trim()) || !amount} className="bg-primary text-primary-foreground">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
