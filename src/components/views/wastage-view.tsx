"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatKg, formatDate, formatTime,
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
  PeriodTabs, SearchInput, EmptyState, Pill,
  PageScaffold, ListSkeleton, Kg,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
interface WastageEntry {
  id: string;
  productId?: string | null;
  name: string;
  kg: number;
  reason: string | null;
  note: string | null;
  userName: string | null;
  createdAt: string;
}
interface WastageResp {
  entries: WastageEntry[];
  stats: { totalKg: number; count: number };
}
interface Product {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
}

const REASONS = ["Spoilt", "Dropped", "Used in prep", "Other"] as const;

// reason pill tone
function reasonTone(reason: string | null): "bad" | "warn" | "muted" | "default" {
  const r = (reason || "").toLowerCase();
  if (r === "spoilt") return "bad";
  if (r === "dropped") return "warn";
  if (r === "used in prep") return "muted";
  return "default";
}

async function fetchWastage(period: PeriodKey, q: string): Promise<WastageResp> {
  const r = await fetch(`/api/meat/wastage?period=${period}&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("failed");
  return r.json();
}

async function fetchProducts(): Promise<{ products: Product[] }> {
  const r = await fetch("/api/meat/products");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

// ─── View ───────────────────────────────────────────────────────────────
export function WastageView() {
  const { back } = useNav();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [recordOpen, setRecordOpen] = React.useState(false);

  // Debounce search
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery<WastageResp>({
    queryKey: ["wastage", period, debouncedQ],
    queryFn: () => fetchWastage(period, debouncedQ),
  });

  const stats = data?.stats;
  const entries = data?.entries ?? [];

  return (
    <PageScaffold
      title="Wastage"
      subtitle="Record wasted meat — no inventory deduction"
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
          Record Waste
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

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search product, reason, note…"
        className="mb-4"
      />

      {/* Period totals */}
      <Card className="mb-5 overflow-hidden card-raised">
        <div className="flex items-stretch divide-x divide-border/60">
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Wasted</p>
            <p className="mt-1 text-2xl font-bold tnum text-red-400">
              <Kg kg={stats?.totalKg ?? 0} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{periodLabel(period)}</p>
          </div>
          <div className="w-28 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-bold tnum">{stats?.count ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">records</p>
          </div>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18l-2 13a2 2 0 0 1-2 1.7H7a2 2 0 0 1-2-1.7L3 6z" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M10 11v5M14 11v5" />
            </svg>
          }
          title="No wastage recorded yet."
          description="Record any wasted meat here — spoilt, dropped, or used in preparation."
          action={
            <Button onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">
              Record Waste
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {entries.map((e) => (
            <WastageRow key={e.id} entry={e} />
          ))}
        </div>
      )}

      <RecordWasteDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function WastageRow({ entry: e }: { entry: WastageEntry }) {
  return (
    <Card className="p-3.5 card-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18l-2 13a2 2 0 0 1-2 1.7H7a2 2 0 0 1-2-1.7L3 6z" />
              <path d="M10 11v5M14 11v5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{e.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {e.note || "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDate(e.createdAt)} · {formatTime(e.createdAt)} · {e.userName || "—"}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tnum text-red-400">
            −<Kg kg={e.kg} />
          </p>
          {e.reason && (
            <Pill tone={reasonTone(e.reason)} className="mt-0.5">{e.reason}</Pill>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Record Waste Dialog ────────────────────────────────────────────────
function RecordWasteDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ["products"],
    queryFn: fetchProducts,
    enabled: open,
  });
  const products = productsData?.products ?? [];

  const [name, setName] = React.useState("");
  const [kg, setKg] = React.useState("");
  const [reason, setReason] = React.useState<string>("");
  const [note, setNote] = React.useState("");

  function reset() {
    setName("");
    setKg("");
    setReason("");
    setNote("");
  }

  const canSave = !!name.trim() && !!kg && (parseFloat(kg) || 0) > 0;

  const save = useMutation({
    mutationFn: async () => {
      const match = products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
      const body: Record<string, unknown> = {
        name: name.trim(),
        kg: Number(kg),
        reason: reason || undefined,
        note: note.trim() || undefined,
      };
      if (match) body.productId = match.id;
      const r = await fetch("/api/meat/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Wastage recorded");
      qc.invalidateQueries({ queryKey: ["wastage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save wastage"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Waste</DialogTitle>
        </DialogHeader>

        <datalist id="waste-products">
          {products.map((p) => (
            <option key={p.id} value={p.name}>{p.emoji} {p.name}</option>
          ))}
        </datalist>
        <datalist id="waste-reasons">
          {REASONS.map((r) => <option key={r} value={r} />)}
        </datalist>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Product</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Select or type a product name"
              list="waste-products"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Kg wasted</Label>
            <Input
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 tnum text-lg"
            />
          </div>

          <div>
            <Label className="text-xs">Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Spoilt / Dropped / Used in prep / Other"
              list="waste-reasons"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. freezer failed overnight"
              className="mt-1"
            />
          </div>

          <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Recording waste here does not deduct from inventory — it is for tracking loss only.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !canSave}
            className="bg-primary text-primary-foreground"
          >
            {save.isPending ? "Saving…" : "Save Waste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
