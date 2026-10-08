"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, formatKg, formatDate, cn, colorFromString } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill, EmptyState, SearchInput } from "@/components/app/primitives";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Product {
  id: string; name: string; emoji: string; priceTakeHome: number; priceEatHere: number; active: boolean; createdAt: string;
  todaySales: number; todayKg: number; todayCount: number;
  allTimeSales: number; allTimeKg: number; allTimeCount: number;
}

async function fetchProducts(): Promise<{ products: Product[] }> {
  const r = await fetch("/api/meat/products");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

type SortMode = "name" | "today" | "alltime";

export function ProductsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [sort, setSort] = React.useState<SortMode>("name");

  const allProducts = data?.products ?? [];
  const filtered = allProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "today") return b.todaySales - a.todaySales;
    if (sort === "alltime") return b.allTimeSales - a.allTimeSales;
    return a.name.localeCompare(b.name);
  });

  const activeCount = allProducts.filter((p) => p.active).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">{activeCount} active · {allProducts.length} total</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground meat-glow">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Add
        </Button>
      </div>

      {/* Sort toggle — simple and clear */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Sort by:</span>
        <div className="flex gap-1.5">
          <button onClick={() => setSort("name")}
            className={cn("rounded-full px-3 py-1 text-xs font-semibold tap-scale", sort === "name" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            Name
          </button>
          <button onClick={() => setSort("today")}
            className={cn("rounded-full px-3 py-1 text-xs font-semibold tap-scale", sort === "today" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            Top Sellers Today
          </button>
          <button onClick={() => setSort("alltime")}
            className={cn("rounded-full px-3 py-1 text-xs font-semibold tap-scale", sort === "alltime" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
            Top Sellers Ever
          </button>
        </div>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search products by name…" className="mb-3" />

      {isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState title="No products found" description="Add your first meat product to start selling." action={<Button onClick={() => setCreating(true)}>Add Product</Button>} />
      ) : (
        <div className="space-y-2">
          {sorted.map((p, idx) => (
            <Card key={p.id} className="overflow-hidden card-raised">
              <button onClick={() => setEditing(p)} className="block w-full p-3 text-left tap-scale">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {(sort === "today" || sort === "alltime") && (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{idx + 1}</span>
                    )}
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg", colorFromString(p.name))}>{p.emoji}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold">{p.name}</p>
                        {!p.active && <span className="text-[9px] font-medium text-red-400">inactive</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground tnum">Take Home {formatBirr(p.priceTakeHome)} · Eat Here {formatBirr(p.priceEatHere)}</p>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </div>

                {/* Sold today */}
                <div className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5">
                  {p.todaySales > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      <span className="text-[11px] font-semibold text-emerald-400">Sold today: {formatBirr(p.todaySales)}</span>
                      <span className="text-[10px] text-muted-foreground tnum">{p.todayCount}× · {formatKg(p.todayKg)}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Not sold today</span>
                  )}
                  {/* All-time total — always visible */}
                  {p.allTimeSales > 0 && (
                    <span className="text-[10px] tnum">
                      <span className="text-emerald-400 font-semibold">Total: {formatBirr(p.allTimeSales)}</span>
                      <span className="text-muted-foreground"> · {p.allTimeCount} sales · {formatKg(p.allTimeKg)}</span>
                    </span>
                  )}
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
          <DialogDescription className="sr-only">{product ? "Edit product details." : "Add a new meat product."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-3">
            <div className="w-20">
              <Label className="text-xs">Icon</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 h-11 text-center text-xl" maxLength={4} />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Product name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ribs" className="mt-1" autoFocus />
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
