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
import { SearchInput, EmptyState, Pill, PageScaffold, ListSkeleton, Money } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import type { PaymentMethod } from "@/lib/accounts";
import { useLang } from "@/components/lang-provider";
import { t as translate, type Lang } from "@/lib/i18n";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  totalDebit: number;
  totalCredit: number;
  balance: number; // positive = we owe them
}

function paymentLabelT(method: string, detail?: string | null, lang: Lang = "en"): string {
  if (method === "CASH") return translate("sell.cash", lang);
  if (method === "MOBILE") return `${translate("sell.mobile", lang)}${detail ? ` · ${detail}` : ""}`;
  if (method === "BANK") return `${translate("sell.bank", lang)}${detail ? ` · ${detail}` : ""}`;
  return method;
}

export function SupplierLedgerView() {
  const { back } = useNav();
  const { t, lang } = useLang();
  const [q, setQ] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch("/api/meat/suppliers");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const suppliers: Supplier[] = data?.suppliers ?? [];
  const filtered = q ? suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : suppliers;
  const totalOwed = suppliers.reduce((s, x) => s + Math.max(0, x.balance), 0);

  return (
    <PageScaffold
      title={t("suppliers.title")}
      subtitle={t("suppliers.subtitle")}
      onBack={() => back()}
      right={
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {t("suppliers.add")}
        </Button>
      }
    >
      {/* Total owed */}
      <Card className="mb-3 card-raised bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("suppliers.totalOwed")}</p>
            <p className="mt-0.5 text-xl font-bold tnum text-red-400">{formatBirr(totalOwed)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{suppliers.filter((s) => s.balance > 0).length} {t("debts.balance").toLowerCase()}</p>
          </div>
        </div>
      </Card>

      <SearchInput value={q} onChange={setQ} placeholder={`${t("common.search")}…`} className="mb-3" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16V4z M8 10h8 M8 14h6 M8 7h8" /></svg>}
          title={t("suppliers.empty")}
          description={t("suppliers.subtitle")}
          action={<Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">{t("suppliers.add")}</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SupplierRow key={s.id} supplier={s} onClick={() => setSelectedSupplier(s)} t={t} />
          ))}
        </div>
      )}

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} />
      {selectedSupplier && <SupplierDetailDialog supplier={selectedSupplier} open={!!selectedSupplier} onOpenChange={(o) => !o && setSelectedSupplier(null)} lang={lang} />}
    </PageScaffold>
  );
}

function SupplierRow({ supplier, onClick, t }: { supplier: Supplier; onClick: () => void; t: (k: string) => string }) {
  const owes = supplier.balance > 0;
  return (
    <Card className="card-raised bg-card p-3">
      <button onClick={onClick} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/30 to-sky-500/10 text-xs font-bold text-sky-400">
              {initials(supplier.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{supplier.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{supplier.phone || "—"}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("text-sm font-bold tnum", owes ? "text-red-400" : "text-emerald-400")}>
              {owes ? formatBirr(supplier.balance) : t("suppliers.clear")}
            </p>
            <Pill tone={owes ? "bad" : "good"} className="mt-0.5">{owes ? t("suppliers.weOwe") : t("suppliers.clear")}</Pill>
          </div>
        </div>
      </button>
    </Card>
  );
}

function SupplierDetailDialog({ supplier, open, onOpenChange, lang }: { supplier: Supplier; open: boolean; onOpenChange: (o: boolean) => void; lang: Lang }) {
  const { t } = useLang();
  const { data } = useQuery({
    queryKey: ["ledger", supplier.id],
    queryFn: async () => {
      const r = await fetch(`/api/meat/ledger?supplierId=${supplier.id}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier.name}</DialogTitle>
          <DialogDescription className="sr-only">{t("suppliers.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-red-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">{t("suppliers.weOwe")}</p>
              <p className="text-sm font-bold tnum text-red-400"><Money amount={supplier.totalDebit} /></p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <p className="text-[10px] text-muted-foreground">{t("suppliers.wePaid")}</p>
              <p className="text-sm font-bold tnum text-emerald-400"><Money amount={supplier.totalCredit} /></p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">{t("debts.balance")}</p>
              <p className={cn("text-sm font-bold tnum", supplier.balance > 0 ? "text-red-400" : "text-emerald-400")}><Money amount={Math.abs(supplier.balance)} /></p>
            </div>
          </div>
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto mb-scroll">
            {data?.entries?.map((e: { id: string; kind: string; amount: number; signedAmount: number; note: string | null; paymentMethod: string | null; paymentDetail: string | null; createdAt: string }) => {
              const methodLabel = e.kind === "CREDIT" && e.paymentMethod
                ? paymentLabelT(e.paymentMethod, e.paymentDetail, lang)
                : null;
              return (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.note || (e.kind === "DEBIT" ? t("purchases.onCredit") : t("suppliers.recordPayment"))}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(e.createdAt)}</p>
                    {methodLabel && (
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {e.paymentMethod === "CASH" ? "💵" : e.paymentMethod === "MOBILE" ? "📱" : "🏦"} {methodLabel}
                        </span>
                      </p>
                    )}
                  </div>
                  <span className={cn("shrink-0 font-bold tnum", e.kind === "DEBIT" ? "text-red-400" : "text-emerald-400")}>
                    {e.kind === "DEBIT" ? "+" : "−"}{formatBirr(e.amount)}
                  </span>
                </div>
              );
            }) ?? <p className="py-4 text-center text-xs text-muted-foreground">{t("common.loading")}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSupplierDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(t("suppliers.supplierAdded"));
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setName(""); setPhone(""); setNote("");
      onOpenChange(false);
    },
    onError: () => toast.error(t("saleFailed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("suppliers.add")}</DialogTitle>
          <DialogDescription className="sr-only">{t("suppliers.add")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{t("suppliers.supplierName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="…" className="mt-1" autoFocus />
          </div>
          <div>
            <Label className="text-xs">{t("suppliers.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{t("suppliers.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()} className="bg-primary text-primary-foreground">
            {save.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
