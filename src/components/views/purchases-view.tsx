"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatBirr, formatKg, formatDate, formatTime,
  type PeriodKey, periodLabel,
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
  PeriodTabs, SearchInput, EmptyState, StatTile, Pill,
  PageScaffold, ListSkeleton, Money, Kg,
} from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import { subAccountName, type PaymentMethod } from "@/lib/accounts";
import { ANIMAL_TYPES, animalName, animalEmoji, animalTone } from "@/lib/animals";

// ─── Types ──────────────────────────────────────────────────────────────
interface PurchaseItem {
  id?: string;
  productId?: string | null;
  name: string;
  animalType?: string | null;
  kg: number;
  unitCost: number;
  total: number;
}
interface Purchase {
  id: string;
  supplier: string | null;
  note: string | null;
  paymentMethod: string;
  paymentDetail?: string | null;
  total: number;
  userName: string | null;
  createdAt: string;
  items: PurchaseItem[];
}
interface PurchasesResp {
  purchases: Purchase[];
  stats: { total: number; count: number };
}
interface Product {
  id: string;
  name: string;
  emoji: string;
  priceTakeHome: number;
  priceEatHere: number;
  active: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function paymentLabel(method: string): string {
  const m = (method || "").toUpperCase();
  if (m === "CASH") return "Cash";
  if (m === "MOBILE") return "Mobile";
  if (m === "BANK") return "Bank";
  return method || "—";
}

async function fetchPurchases(period: PeriodKey, q: string): Promise<PurchasesResp> {
  const r = await fetch(`/api/meat/purchases?period=${period}&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

async function fetchProducts(): Promise<{ products: Product[] }> {
  const r = await fetch("/api/meat/products");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function PurchasesView() {
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
  const [recordOpen, setRecordOpen] = React.useState(false);

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const isCustom = period === "CUSTOM";
  const queryKey = isCustom
    ? ["purchases", "CUSTOM", customFrom, customTo, debouncedQ]
    : ["purchases", period, debouncedQ];

  const { data, isLoading } = useQuery<PurchasesResp>({
    queryKey,
    queryFn: async () => {
      if (isCustom) {
        const r = await fetch(`/api/meat/purchases?period=ALL&q=${encodeURIComponent(debouncedQ)}`);
        if (!r.ok) throw new Error("failed");
        const j: PurchasesResp = await r.json();
        const fromD = new Date(customFrom + "T00:00:00");
        const toD = new Date(customTo + "T23:59:59.999");
        const filtered = j.purchases.filter((p) => {
          const c = new Date(p.createdAt);
          return c >= fromD && c <= toD;
        });
        const total = filtered.reduce((s, p) => s + p.total, 0);
        return { purchases: filtered, stats: { total, count: filtered.length } };
      }
      return fetchPurchases(period, debouncedQ);
    },
  });

  const stats = data?.stats;
  const purchases = data?.purchases ?? [];

  return (
    <PageScaffold
      title="Purchases"
      subtitle="Money out for meat & supplies"
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
          Record Purchase
        </Button>
      }
    >
      <div className="mb-4">
        <PeriodTabs
          value={period}
          onChange={setPeriod}
          periods={["TODAY", "7D", "30D", "MONTH", "CUSTOM"]}
        />
      </div>

      {isCustom && (
        <Card className="mb-4 grid grid-cols-2 gap-3 p-3 card-raised">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 tnum" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 tnum" />
          </div>
        </Card>
      )}

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search supplier, note, user…"
        className="mb-4"
      />

      {/* Period totals */}
      <Card className="mb-5 overflow-hidden card-raised">
        <div className="flex items-stretch divide-x divide-border/60">
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Purchases</p>
            <p className="mt-1 text-2xl font-bold tnum text-red-400">
              <Money amount={stats?.total ?? 0} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{periodLabel(period)}</p>
          </div>
          <div className="w-28 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-bold tnum">{stats?.count ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">purchases</p>
          </div>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 7h14l-1.5 9.5a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 7z" />
              <path d="M9 7V5a3 3 0 0 1 6 0v2" />
            </svg>
          }
          title="No purchases recorded yet."
          description="Record your first meat purchase from a supplier to track money out."
          action={
            <Button onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">
              Record Purchase
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {purchases.map((p) => (
            <PurchaseRow key={p.id} purchase={p} />
          ))}
        </div>
      )}

      <RecordPurchaseDialog open={recordOpen} onOpenChange={setRecordOpen} period={period} />
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function PurchaseRow({ purchase: p }: { purchase: Purchase }) {
  const itemCount = p.items.length;
  const kg = p.items.reduce((s, i) => s + (Number(i.kg) || 0), 0);
  // animal types in this purchase (for chips)
  const animals = p.items
    .map((i) => i.animalType)
    .filter(Boolean) as string[];
  const uniqueAnimals = Array.from(new Set(animals));
  // primary animal emoji for the icon
  const primaryAnimal = p.items.find((i) => i.animalType)?.animalType;

  return (
    <Card className="p-3.5 card-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ring-1 ${primaryAnimal ? animalTone(primaryAnimal) : "bg-red-500/15 text-red-400 ring-red-500/20"}`}>
            {primaryAnimal ? animalEmoji(primaryAnimal) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.supplier || "—"}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {p.note || "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDate(p.createdAt)} · {formatTime(p.createdAt)} · {p.userName || "—"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tnum text-red-400">
            −<Money amount={p.total} />
          </p>
          <Pill tone="muted" className="mt-0.5">
            {p.paymentDetail ? subAccountName(p.paymentMethod as PaymentMethod, p.paymentDetail) : paymentLabel(p.paymentMethod)}
          </Pill>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Pill tone="bad">Money Out</Pill>
        {uniqueAnimals.length > 0 ? (
          uniqueAnimals.map((a) => (
            <span key={a} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${animalTone(a)}`}>
              {animalEmoji(a)} {animalName(a)}
            </span>
          ))
        ) : null}
        <span className="text-[11px] text-muted-foreground">
          {itemCount} {itemCount === 1 ? "animal" : "animals"} · <Kg kg={kg} />
        </span>
      </div>
    </Card>
  );
}

// ─── Record Purchase Dialog ─────────────────────────────────────────────
interface RowItem {
  key: string;
  productId: string | null;
  animalType: string; // OX | SHEEP | GOAT
  name: string;
  kg: string;
  amount: string; // manually-entered total paid (NOT auto-calculated)
}

function RecordPurchaseDialog({
  open, onOpenChange, period,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  period: PeriodKey;
}) {
  const qc = useQueryClient();
  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const products = productsData?.products ?? [];

  const [supplier, setSupplier] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "MOBILE" | "BANK">("CASH");
  const [paymentDetail, setPaymentDetail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [rows, setRows] = React.useState<RowItem[]>(() => [emptyRow()]);

  function reset() {
    setSupplier("");
    setPaymentMethod("CASH");
    setPaymentDetail("");
    setNote("");
    setRows([emptyRow()]);
  }

  function updateRow(key: string, patch: Partial<RowItem>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }

  // computed totals per row + grand total (amount is manually entered, NOT auto-calc)
  const computed = rows.map((r) => {
    const kg = parseFloat(r.kg) || 0;
    const amount = parseFloat(r.amount) || 0;
    const perKg = kg > 0 ? amount / kg : 0; // derived, for display only
    return { key: r.key, amount, perKg, hasContent: !!(r.animalType && kg > 0 && amount > 0) };
  });
  const grandTotal = computed.reduce((s, c) => s + c.amount, 0);
  const hasValidItem = computed.some((c) => c.hasContent);
  const canSave = hasValidItem;

  const save = useMutation({
    mutationFn: async () => {
      const items = rows
        .filter((r) => (parseFloat(r.kg) || 0) > 0 && (parseFloat(r.amount) || 0) > 0)
        .map((r) => {
          const kg = parseFloat(r.kg) || 0;
          const amount = parseFloat(r.amount) || 0;
          return {
            animalType: r.animalType,
            name: r.animalType || r.name.trim() || "Item",
            kg,
            amount,
          };
        });
      const r = await fetch("/api/meat/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: supplier.trim() || undefined,
          note: note.trim() || undefined,
          paymentMethod,
          paymentDetail,
          items,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Purchase recorded");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save purchase"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Purchase</DialogTitle>
          <DialogDescription className="sr-only">Record a whole-animal purchase (ox, sheep, or goat) with weight and negotiated amount.</DialogDescription>
        </DialogHeader>

        <datalist id="purchase-products">
          {products.map((p) => (
            <option key={p.id} value={p.name}>{p.emoji} {p.name}</option>
          ))}
        </datalist>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Supplier</Label>
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Kifle Butcher Supply"
              className="mt-1"
              autoFocus
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Animals purchased</Label>
              <span className="text-[11px] text-muted-foreground">type · weight · amount</span>
            </div>
            <div className="mt-1.5 space-y-2.5">
              {rows.map((r) => {
                const c = computed.find((x) => x.key === r.key)!;
                return (
                  <div key={r.key} className="rounded-xl border border-border/70 bg-card/40 p-2.5">
                    {/* Animal type selector — Ox / Sheep / Goat */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 gap-1.5">
                        {ANIMAL_TYPES.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => updateRow(r.key, { animalType: a.id, name: a.name })}
                            className={cn(
                              "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold tap-scale",
                              r.animalType === a.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-muted-foreground"
                            )}
                          >
                            <span className="text-base">{a.emoji}</span>
                            {a.short}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground hover:bg-red-500/15 hover:text-red-400 tap-scale"
                        aria-label="Remove animal"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* Weight + Amount (manual entry) */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Weight (kg)</Label>
                        <Input
                          value={r.kg}
                          onChange={(e) => updateRow(r.key, { kg: e.target.value })}
                          inputMode="decimal"
                          placeholder="e.g. 180"
                          className="h-9 tnum text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Amount paid (Br)</Label>
                        <Input
                          value={r.amount}
                          onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                          inputMode="decimal"
                          placeholder="e.g. 54000"
                          className="h-9 tnum text-sm"
                        />
                      </div>
                    </div>
                    {/* Derived per-kg cost (display only) */}
                    {c.perKg > 0 && (
                      <div className="mt-1.5 flex items-center justify-between rounded-md bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
                        <span>Negotiated price</span>
                        <span className="tnum font-medium">{formatBirr(c.perKg)} / kg</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary tap-scale"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add another animal
            </button>
          </div>

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. bulk buy — paid on delivery"
              className="mt-1"
            />
          </div>

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/20">
            <span className="text-sm font-semibold">Grand total</span>
            <span className="text-lg font-bold tnum">{formatBirr(grandTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !canSave}
            className="bg-primary text-primary-foreground"
          >
            {save.isPending ? "Saving…" : "Save Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyRow(): RowItem {
  return { key: Math.random().toString(36).slice(2), productId: null, animalType: "OX", name: "", kg: "", amount: "" };
}
