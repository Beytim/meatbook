"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import { cn, formatKg, formatDate, formatTime, type PeriodKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PeriodTabs, SearchInput, EmptyState, Pill, PageScaffold, ListSkeleton, Kg } from "@/components/app/primitives";

interface WastageEntry {
  id: string;
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

const REASONS = ["Spoilt", "Dropped", "Used in prep", "Expired", "Other"];

export function WastageView() {
  const { back } = useNav();
  const [period, setPeriod] = React.useState<PeriodKey>("TODAY");
  const [q, setQ] = React.useState("");
  const [recordOpen, setRecordOpen] = React.useState(false);

  const { data, isLoading } = useQuery<WastageResp>({
    queryKey: ["wastage", period, q],
    queryFn: async () => {
      const r = await fetch(`/api/meat/wastage?period=${period}&q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const entries = data?.entries ?? [];
  const stats = data?.stats;

  return (
    <PageScaffold
      title="Wastage"
      subtitle="Record wasted meat — no inventory deduction"
      onBack={() => back()}
      right={
        <Button size="sm" onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Record
        </Button>
      }
    >
      <div className="mb-3">
        <PeriodTabs value={period} onChange={setPeriod} periods={["TODAY", "7D", "30D", "MONTH", "ALL"]} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="card-raised bg-card p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Wasted</p>
          <p className="mt-0.5 text-base font-bold tnum text-red-400"><Kg kg={stats?.totalKg ?? 0} /></p>
        </Card>
        <Card className="card-raised bg-card p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entries</p>
          <p className="mt-0.5 text-base font-bold tnum">{stats?.count ?? 0}</p>
        </Card>
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Search product, reason, note…" className="mb-3" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 5a3.5 3.5 0 0 1 0 5l-5 5a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0z M9 9l6 6" /></svg>}
          title="No wastage recorded yet"
          description="Record any wasted meat here — spoilt, dropped, or used in preparation."
          action={<Button onClick={() => setRecordOpen(true)} className="bg-primary text-primary-foreground">Record Waste</Button>}
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => <WastageRow key={e.id} entry={e} />)}
        </div>
      )}

      <RecordWastageDialog open={recordOpen} onOpenChange={setRecordOpen} period={period} />
    </PageScaffold>
  );
}

// ─── Row with delete ─────────────────────────────────────────────────
function WastageRow({ entry: e }: { entry: WastageEntry }) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/meat/wastage/${e.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("Waste entry deleted");
      qc.invalidateQueries({ queryKey: ["wastage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete"),
  });
  return (
    <Card className="card-raised bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-400">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 5a3.5 3.5 0 0 1 0 5l-5 5a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0z M9 9l6 6" /></svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{e.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{e.reason || e.note || "—"} · {e.userName || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{formatDate(e.createdAt)} · {formatTime(e.createdAt)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tnum text-red-400">−<Kg kg={e.kg} /></p>
          {e.reason && <Pill tone="bad" className="mt-0.5">{e.reason}</Pill>}
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

function RecordWastageDialog({ open, onOpenChange, period: _period }: { open: boolean; onOpenChange: (o: boolean) => void; period: PeriodKey }) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [kg, setKg] = React.useState("");
  const [reason, setReason] = React.useState("Spoilt");
  const [note, setNote] = React.useState("");

  function reset() { setName(""); setKg(""); setReason("Spoilt"); setNote(""); }

  const canSave = !!name.trim() && (parseFloat(kg) || 0) > 0;

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kg: Number(kg), reason, note: note.trim() || undefined }),
      });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Wastage recorded");
      qc.invalidateQueries({ queryKey: ["wastage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Waste</DialogTitle>
          <DialogDescription className="sr-only">Record wasted meat with weight and reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Product / meat type</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meat, Liver, Ribs" className="mt-1" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Weight (kg)</Label>
            <Input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="e.g. 2.5" className="mt-1 tnum" />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold tap-scale", reason === r ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSave} className="bg-primary text-primary-foreground">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
