"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { cn, formatBirr, formatKg, formatDate, formatTime, type PeriodKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PeriodTabs, SearchInput, EmptyState, Pill, PageScaffold, ListSkeleton, Money, Kg } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import { subAccountName, type PaymentMethod } from "@/lib/accounts";
import { ANIMAL_TYPES, animalName, animalEmoji, animalTone } from "@/lib/animals";
import { useLang } from "@/components/lang-provider";
import { t as translate, type Lang } from "@/lib/i18n";

interface PurchaseItem {
  id?: string;
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
  stats: { total: number; count: number; totalKg?: number };
}

function paymentLabelT(m: string, lang: Lang = "en"): string {
  if (m === "CASH") return translate("sell.cash", lang);
  if (m === "MOBILE") return translate("sell.mobile", lang);
  if (m === "BANK") return translate("sell.bank", lang);
  if (m === "CREDIT") return translate("sell.credit", lang);
  return m;
}

export function PurchasesView() {
  const { back } = useNav();
  const { t, lang } = useLang();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [recordOpen, setRecordOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PurchasesResp>({
    queryKey: ["purchases", period, q],
    queryFn: async () => {
      const r = await fetch(`/api/meat/purchases?period=${period}&q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const purchases = data?.purchases ?? [];
  const stats = data?.stats;

  return (
    <PageScaffold
      title={t("purchases.title")}
      subtitle={t("purchases.subtitle")}
      onBack={() => back()}
      right={
        <Button size="sm" onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("purchases.record")}
        </Button>
      }
    >
      <div className="mb-3">
        <PeriodTabs value={period} onChange={setPeriod} periods={["TODAY", "7D", "30D", "MONTH", "ALL"]} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="card-raised bg-card p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.total")}</p>
          <p className="mt-0.5 text-base font-bold tnum text-red-400">−{formatBirr(stats?.total ?? 0)}</p>
        </Card>
        <Card className="card-raised bg-card p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("purchases.title")}</p>
          <p className="mt-0.5 text-base font-bold tnum">{stats?.count ?? 0}</p>
        </Card>
      </div>

      <SearchInput value={q} onChange={setQ} placeholder={`${t("common.search")}…`} className="mb-3" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18 M7 10l3 3 4-5" /></svg>}
          title={t("purchases.empty")}
          description={t("purchases.subtitle")}
          action={<Button onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">{t("purchases.record")}</Button>}
        />
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => {
            const kg = p.items.reduce((s, i) => s + (Number(i.kg) || 0), 0);
            const animals = Array.from(new Set(p.items.map((i) => i.animalType).filter(Boolean))) as string[];
            const primary = p.items.find((i) => i.animalType)?.animalType;
            return (
              <Card key={p.id} className="card-raised bg-card p-3">
                <PurchaseRow purchase={p} kg={kg} animals={animals} primary={primary} lang={lang} />
              </Card>
            );
          })}
        </div>
      )}

      <RecordPurchaseDialog open={recordOpen} onOpenChange={setRecordOpen} period={period} />
    </PageScaffold>
  );
}

// ─── Row with delete ─────────────────────────────────────────────────
function PurchaseRow({ purchase: p, kg, animals, primary, lang }: {
  purchase: Purchase; kg: number; animals: string[]; primary?: string; lang: Lang;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meat/purchases/${p.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(t("purchases.recorded"));
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: () => toast.error(t("saleFailed")),
  });
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ring-1 ${primary ? animalTone(primary) : "bg-red-500/15 text-red-400 ring-red-500/20"}`}>
            {primary ? animalEmoji(primary) : "↓"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.supplier || "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{p.note || formatDate(p.createdAt)} · {p.userName || "—"}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tnum text-red-400">−<Money amount={p.total} /></p>
          <Pill tone="muted" className="mt-0.5">{p.paymentDetail ? subAccountName(p.paymentMethod as PaymentMethod, p.paymentDetail) : paymentLabelT(p.paymentMethod, lang)}</Pill>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {animals.map((a) => (
          <span key={a} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${animalTone(a)}`}>
            {animalEmoji(a)} {animalName(a)}
          </span>
        ))}
        <span className="text-[10px] text-muted-foreground tnum">{p.items.length} × · <Kg kg={kg} /></span>
      </div>
      {confirmDel ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDel(false)}>{t("common.cancel")}</Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => del.mutate()} disabled={del.isPending}>{del.isPending ? t("common.loading") : `${t("common.confirm")} ${t("common.delete")}`}</Button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)} className="mt-1.5 text-[10px] font-medium text-red-400/70 hover:text-red-400">{t("common.delete")}</button>
      )}
    </>
  );
}

// ─── Record Purchase Dialog (simplified, animal-based) ──────────────────
interface RowItem {
  key: string;
  animalType: string;
  kg: string;
  amount: string;
}

function RecordPurchaseDialog({ open, onOpenChange, period: _period }: { open: boolean; onOpenChange: (o: boolean) => void; period: PeriodKey }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [supplier, setSupplier] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "MOBILE" | "BANK" | "CREDIT">("CASH");
  const [paymentDetail, setPaymentDetail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [rows, setRows] = React.useState<RowItem[]>(() => [{ key: "1", animalType: "OX", kg: "", amount: "" }]);
  const [supplierId, setSupplierId] = React.useState("");
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string }[]>([]);

  const fetchSuppliers = React.useCallback(async () => {
    try {
      const r = await fetch("/api/meat/suppliers");
      const d = await r.json();
      setSuppliers(d.suppliers ?? []);
    } catch { /* ignore */ }
  }, []);

  function reset() {
    setSupplier(""); setPaymentMethod("CASH"); setPaymentDetail(""); setNote(""); setSupplierId("");
    setRows([{ key: "1", animalType: "OX", kg: "", amount: "" }]);
  }

  const computed = rows.map((r) => {
    const kg = parseFloat(r.kg) || 0;
    const amount = parseFloat(r.amount) || 0;
    return { key: r.key, amount, perKg: kg > 0 ? amount / kg : 0, valid: kg > 0 && amount > 0 };
  });
  const grandTotal = computed.reduce((s, c) => s + c.amount, 0);
  const canSave = computed.some((c) => c.valid);

  const save = useMutation({
    mutationFn: async () => {
      const items = rows
        .filter((r) => (parseFloat(r.kg) || 0) > 0 && (parseFloat(r.amount) || 0) > 0)
        .map((r) => ({
          animalType: r.animalType,
          name: r.animalType,
          kg: parseFloat(r.kg) || 0,
          amount: parseFloat(r.amount) || 0,
        }));
      // For credit purchases, resolve/create supplier if needed
      let supId = supplierId;
      if (paymentMethod === "CREDIT" && !supId && supplier.trim()) {
        const sr = await fetch("/api/meat/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: supplier.trim() }),
        });
        const sd = await sr.json();
        supId = sd.supplier.id;
      }
      const r = await fetch("/api/meat/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier: supplier.trim() || undefined, note: note.trim() || undefined, paymentMethod, paymentDetail, items, supplierId: paymentMethod === "CREDIT" ? supId : undefined }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(t("purchases.recorded"));
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("purchases.record")}</DialogTitle>
          <DialogDescription className="sr-only">{t("purchases.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{t("purchases.supplier")}</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="…" className="mt-1" autoFocus />
          </div>
          <div>
            <Label className="text-xs">{t("sell.paymentMethod")}</Label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {(["CASH", "MOBILE", "BANK", "CREDIT"] as const).map((m) => (
                <button key={m} type="button" onClick={() => { setPaymentMethod(m); setPaymentDetail(""); if (m === "CREDIT") fetchSuppliers(); }}
                  className={cn("rounded-lg py-2 text-xs font-semibold tap-scale", paymentMethod === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {m === "CASH" ? t("sell.cash") : m === "MOBILE" ? t("sell.mobile") : m === "BANK" ? t("sell.bank") : t("sell.credit")}
                </button>
              ))}
            </div>
          </div>
          {paymentMethod !== "CASH" && paymentMethod !== "CREDIT" && (
            <div>
              <Label className="text-xs">{paymentMethod === "MOBILE" ? t("sell.provider") : t("sell.bankLabel")}</Label>
              <div className="mt-1"><AccountProviderSelect method={paymentMethod} value={paymentDetail} onChange={setPaymentDetail} /></div>
            </div>
          )}
          {paymentMethod === "CREDIT" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">{t("purchases.onCredit")}</p>
              {suppliers.length > 0 && (
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                  className="mb-1.5 h-8 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-xs">
                  <option value="">{t("purchases.selectSupplier")}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <p className="text-[10px] text-muted-foreground">{t("purchases.newSupplier")}</p>
            </div>
          )}
          <div>
            <Label className="text-xs">{t("purchases.animals")}</Label>
            <div className="mt-1.5 space-y-2">
              {rows.map((r, idx) => {
                const c = computed.find((x) => x.key === r.key)!;
                return (
                  <div key={r.key} className="rounded-xl border border-border/70 bg-card/40 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-1 gap-1">
                        {ANIMAL_TYPES.map((a) => (
                          <button key={a.id} type="button" onClick={() => updateRow(r.key, { animalType: a.id })}
                            className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold tap-scale", r.animalType === a.id ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                            <span>{a.emoji}</span>{a.short}
                          </button>
                        ))}
                      </div>
                      {rows.length > 1 && (
                        <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground hover:bg-red-500/15 hover:text-red-400 tap-scale">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t("purchases.weight")}</Label>
                        <Input value={r.kg} onChange={(e) => updateRow(r.key, { kg: e.target.value })} inputMode="decimal" placeholder="180" className="h-9 tnum text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t("purchases.amount")}</Label>
                        <Input value={r.amount} onChange={(e) => updateRow(r.key, { amount: e.target.value })} inputMode="decimal" placeholder="54000" className="h-9 tnum text-sm" />
                      </div>
                    </div>
                    {c.perKg > 0 && (
                      <p className="mt-1 text-[10px] text-muted-foreground tnum">{formatBirr(c.perKg)} / kg</p>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setRows((rs) => [...rs, { key: String(rs.length + 1), animalType: "OX", kg: "", amount: "" }])}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary tap-scale">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              {t("purchases.addAnimal")}
            </button>
          </div>
          <div>
            <Label className="text-xs">{t("purchases.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 ring-1 ring-primary/20">
            <span className="text-sm font-semibold">{t("purchases.grandTotal")}</span>
            <span className="text-base font-bold tnum">{formatBirr(grandTotal)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSave} className="bg-primary text-primary-foreground">
            {save.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function updateRow(key: string, patch: Partial<RowItem>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
}
