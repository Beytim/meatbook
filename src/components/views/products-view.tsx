"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, formatDate, cn, colorFromString } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill, EmptyState, SearchInput } from "@/components/app/primitives";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Product {
  id: string; name: string; emoji: string; priceTakeHome: number; priceEatHere: number; active: boolean; createdAt: string;
}

async function fetchProducts(): Promise<{ products: Product[] }> {
  const r = await fetch("/api/meat/products");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export function ProductsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [creating, setCreating] = React.useState(false);

  const products = (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const activeCount = (data?.products ?? []).filter((p) => p.active).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">{activeCount} active · {data?.products.length ?? 0} total</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground meat-glow">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Product
        </Button>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search products by name…" className="mb-4" />

      {isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : products.length === 0 ? (
        <EmptyState title="No products found" description="Add your first meat product to start selling." action={<Button onClick={() => setCreating(true)}>Add Product</Button>} />
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden card-raised">
              <button onClick={() => setEditing(p)} className="block w-full p-4 text-left tap-scale">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-xl", colorFromString(p.name))}>{p.emoji}</div>
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Pill tone={p.active ? "good" : "muted"}>{p.active ? "Active" : "Inactive"}</Pill>
                        <span className="text-[10px] text-muted-foreground">Added {formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-amber-500/10 p-2.5 ring-1 ring-amber-500/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Take Home · OUT</p>
                    <p className="mt-0.5 text-base font-bold tnum">{formatBirr(p.priceTakeHome)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 ring-1 ring-emerald-500/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Eat Here · IN</p>
                    <p className="mt-0.5 text-base font-bold tnum">{formatBirr(p.priceEatHere)}</p>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ProductDialog
          product={editing}
          open={!!editing || creating}
          onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["products"] }); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ProductDialog({ product, open, onOpenChange, onSaved }: { product: Product | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("🥩");
  const [priceTakeHome, setPriceTakeHome] = React.useState("");
  const [priceEatHere, setPriceEatHere] = React.useState("");
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (product) {
      setName(product.name); setEmoji(product.emoji); setPriceTakeHome(String(product.priceTakeHome)); setPriceEatHere(String(product.priceEatHere)); setActive(product.active);
    } else {
      setName(""); setEmoji("🥩"); setPriceTakeHome(""); setPriceEatHere(""); setActive(true);
    }
  }, [product, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name, emoji, priceTakeHome: Number(priceTakeHome) || 0, priceEatHere: Number(priceEatHere) || 0, active };
      const r = product
        ? await fetch(`/api/meat/products/${product.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/meat/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    onSuccess: () => { toast.success(product ? "Product updated" : "Product created"); onSaved(); },
    onError: () => toast.error(product ? "Could not update product" : "Could not create product"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const r = await fetch(`/api/meat/products/${product.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => { toast.success("Product deleted"); onSaved(); },
    onError: () => toast.error("Could not delete — product may be in use"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-3">
            <div className="w-20">
              <Label className="text-xs">Icon</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 h-11 text-center text-xl" maxLength={4} />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Product name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ribs" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Take Home · OUT (Br /kg)</Label>
              <Input value={priceTakeHome} onChange={(e) => setPriceTakeHome(e.target.value)} inputMode="decimal" placeholder="1300" className="mt-1 tnum" />
            </div>
            <div>
              <Label className="text-xs">Eat Here · IN (Br /kg)</Label>
              <Input value={priceEatHere} onChange={(e) => setPriceEatHere(e.target.value)} inputMode="decimal" placeholder="1600" className="mt-1 tnum" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-[11px] text-muted-foreground">Inactive products can&apos;t be sold</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {product && (
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending} className="mr-auto">Delete</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name} className="bg-primary text-primary-foreground">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
