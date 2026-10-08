"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatBirr, formatDate, formatTime,
  type PeriodKey, periodLabel,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  PeriodTabs, SearchInput, EmptyState, Pill,
  PageScaffold, ListSkeleton, Money,
} from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import { subAccountName, type PaymentMethod } from "@/lib/accounts";

// ─── Types ──────────────────────────────────────────────────────────────
interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  paymentMethod: string;
  paymentDetail?: string | null;
  frequency?: string | null;
  userName: string | null;
  createdAt: string;
}
interface CategoryAgg {
  category: string;
  _sum: { amount: number };
  _count: number;
}
interface ExpensesResp {
  expenses: Expense[];
  stats: { total: number; count: number };
  categories: CategoryAgg[];
}

const SUGGESTED_CATEGORIES = [
  "Rent", "Electricity", "Water", "Transport",
  "Salaries", "Supplies", "Maintenance", "Other",
] as const;

// deterministic color pill tone for category
const CATEGORY_TONES: Record<string, "primary" | "good" | "warn" | "bad" | "muted" | "default"> = {
  rent: "warn",
  electricity: "warn",
  water: "primary",
  transport: "muted",
  salaries: "good",
  supplies: "primary",
  maintenance: "warn",
  other: "muted",
};

function categoryTone(category: string): "primary" | "good" | "warn" | "bad" | "muted" | "default" {
  return CATEGORY_TONES[category.toLowerCase()] ?? "default";
}

function paymentLabel(method: string): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return "Cash";
  if (m === "MOBILE") return "Mobile";
  if (m === "BANK") return "Bank";
  return method || "—";
}

async function fetchExpenses(period: PeriodKey, category: string, q: string): Promise<ExpensesResp> {
  const params = new URLSearchParams({ period, q });
  if (category && category !== "ALL") params.set("category", category);
  const r = await fetch(`/api/meat/expenses?${params.toString()}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function ExpensesView() {
  const { back } = useNav();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [category, setCategory] = React.useState<string>("ALL");
  const [q, setQ] = React.useState("");
  const [recordOpen, setRecordOpen] = React.useState(false);

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery<ExpensesResp>({
    queryKey: ["expenses", period, category, debouncedQ],
    queryFn: () => fetchExpenses(period, category, debouncedQ),
  });

  const stats = data?.stats;
  const expenses = data?.expenses ?? [];
  const knownCategories = (data?.categories ?? [])
    .map((c) => c.category)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .sort();

  return (
    <PageScaffold
      title="Expenses"
      subtitle="Money out for shop operations"
      onBack={() => back()}
      right={
        <Button
          size="sm"
          onClick={() => setRecordOpen(true)}
          className="bg-primary text-primary-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Record Expense
        </Button>
      }
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "7D", "30D", "MONTH", "CUSTOM", "ALL"]}
        />
      </div>

      {/* Category filter */}
      <div className="mb-3 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground shrink-0">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger size="sm" className="h-9 flex-1 bg-card/60">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {knownCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search category, note, user…"
        className="mb-4"
      />

      {/* Period totals */}
      <Card className="mb-5 overflow-hidden card-raised">
        <div className="flex items-stretch divide-x divide-border/60">
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Expenses</p>
            <p className="mt-1 text-2xl font-bold tnum text-red-400">
              <Money amount={stats?.total ?? 0} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{periodLabel(period)}</p>
          </div>
          <div className="w-28 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-bold tnum">{stats?.count ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">expenses</p>
          </div>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <path d="M7 15h4" />
            </svg>
          }
          title="No expenses recorded yet."
          description="Record your first shop expense to track money out for operations."
          action={
            <Button onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">
              Record Expense
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </div>
      )}

      <RecordExpenseDialog open={recordOpen} onOpenChange={setRecordOpen} knownCategories={knownCategories} />
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function ExpenseRow({ expense: e }: { expense: Expense }) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meat/expenses/${e.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
    },
    onError: () => toast.error("Could not delete"),
  });
  return (
    <Card className="p-3 card-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Pill tone={categoryTone(e.category)}>{e.category}</Pill>
              {e.frequency === "MONTHLY" && <Pill tone="warn">Monthly</Pill>}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{e.note || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{formatDate(e.createdAt)} · {formatTime(e.createdAt)} · {e.userName || "—"}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tnum text-red-400">−<Money amount={e.amount} /></p>
          <Pill tone="muted" className="mt-0.5">{e.paymentDetail ? subAccountName(e.paymentMethod as PaymentMethod, e.paymentDetail) : paymentLabel(e.paymentMethod)}</Pill>
        </div>
      </div>
      {confirmDel ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDel(false)}>Cancel</Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => del.mutate()} disabled={del.isPending}>{del.isPending ? "Deleting…" : "Confirm Delete"}</Button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)} className="mt-1.5 text-[10px] font-medium text-red-400/70 hover:text-red-400">Delete</button>
      )}
    </Card>
  );
}

// ─── Record Expense Dialog ──────────────────────────────────────────────
function RecordExpenseDialog({
  open, onOpenChange, knownCategories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  knownCategories: string[];
}) {
  const qc = useQueryClient();
  const [category, setCategory] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "MOBILE" | "BANK">("CASH");
  const [paymentDetail, setPaymentDetail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [frequency, setFrequency] = React.useState<"ONE_TIME" | "MONTHLY">("ONE_TIME");

  function reset() {
    setCategory("");
    setAmount("");
    setPaymentMethod("CASH");
    setPaymentDetail("");
    setNote("");
    setFrequency("ONE_TIME");
  }

  const canSave = !!category.trim() && !!amount && (parseFloat(amount) || 0) > 0;

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim(),
          amount: Number(amount),
          paymentMethod,
          paymentDetail,
          frequency,
          note: note.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save expense"),
  });

  // merge suggested + known categories, dedupe
  const allSuggestions = Array.from(new Set([...SUGGESTED_CATEGORIES, ...knownCategories]));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>

        <datalist id="expense-categories">
          {allSuggestions.map((c) => <option key={c} value={c} />)}
        </datalist>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Rent, Electricity, Transport…"
              list="expense-categories"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Amount (Br)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 tnum text-lg"
            />
          </div>

          <div>
            <Label className="text-xs">Payment method</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["CASH", "MOBILE", "BANK"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setPaymentMethod(m); setPaymentDetail(""); }}
                  className={cn(
                    "rounded-lg py-2 text-xs font-semibold tap-scale",
                    paymentMethod === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  {m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile" : "Bank"}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod !== "CASH" && (
            <div>
              <Label className="text-xs">{paymentMethod === "MOBILE" ? "Provider" : "Bank"}</Label>
              <div className="mt-1">
                <AccountProviderSelect method={paymentMethod} value={paymentDetail} onChange={setPaymentDetail} />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Frequency</Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setFrequency("ONE_TIME")}
                className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", frequency === "ONE_TIME" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                One-time
              </button>
              <button type="button" onClick={() => setFrequency("MONTHLY")}
                className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", frequency === "MONTHLY" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                Monthly (÷30 daily)
              </button>
            </div>
            {frequency === "MONTHLY" && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Monthly expense: full amount is paid now, but only 1/30 hits daily profit.
                E.g. Br 4,000 rent = Br 133.33/day in the dashboard.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. monthly electricity bill — paid via mobile"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !canSave}
            className="bg-primary text-primary-foreground"
          >
            {save.isPending ? "Saving…" : "Save Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
