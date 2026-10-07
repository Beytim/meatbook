"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, cn, colorFromString } from "@/lib/utils";
import { useNav } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";

interface Product {
  id: string;
  name: string;
  emoji: string;
  priceTakeHome: number;
  priceEatHere: number;
  active: boolean;
}

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  kg: number;
  total: number;
}

type SaleType = "TAKE_HOME" | "EAT_HERE";
type PaymentMethod = "CASH" | "MOBILE" | "BANK";

async function fetchProducts(): Promise<{ products: Product[] }> {
  const r = await fetch("/api/meat/products");
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export function SellView() {
  const qc = useQueryClient();
  const go = useNav((s) => s.go);
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [saleType, setSaleType] = React.useState<SaleType>("TAKE_HOME");
  const [payment, setPayment] = React.useState<PaymentMethod>("CASH");
  const [paymentDetail, setPaymentDetail] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [query, setQuery] = React.useState("");
  const [kgMode, setKgMode] = React.useState<null | { productId: string; name: string; unitPrice: number }>(null);
  const [customKg, setCustomKg] = React.useState("");
  const [lastSale, setLastSale] = React.useState<{ number: string; total: number } | null>(null);

  const products = (data?.products ?? []).filter((p) => p.active);
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const priceFor = (p: Product) => (saleType === "TAKE_HOME" ? p.priceTakeHome : p.priceEatHere);

  const addToCart = (p: Product, kg = 0.5) => {
    const unitPrice = priceFor(p);
    const total = Math.round(unitPrice * kg * 100) / 100;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        const newKg = Math.round((existing.kg + kg) * 100) / 100;
        return prev.map((i) => i.productId === p.id ? { ...i, kg: newKg, total: Math.round(unitPrice * newKg * 100) / 100 } : i);
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice, kg, total }];
    });
  };

  const openKgMode = (p: Product) => {
    setKgMode({ productId: p.id, name: p.name, unitPrice: priceFor(p) });
    setCustomKg("");
  };

  const confirmCustomKg = () => {
    if (!kgMode) return;
    const kg = parseFloat(customKg);
    if (!kg || kg <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    const product = products.find((p) => p.id === kgMode.productId);
    if (product) addToCart(product, Math.round(kg * 100) / 100);
    setKgMode(null);
    setCustomKg("");
  };

  const adjustKg = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newKg = Math.round((i.kg + delta) * 100) / 100;
          return { ...i, kg: newKg, total: Math.round(i.unitPrice * newKg * 100) / 100 };
        })
        .filter((i) => i.kg > 0)
    );
  };

  const removeItem = (productId: string) => setCart((prev) => prev.filter((i) => i.productId !== productId));

  const total = cart.reduce((s, i) => s + i.total, 0);
  const totalKg = cart.reduce((s, i) => s + i.kg, 0);

  const checkout = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: saleType,
          paymentMethod: payment,
          paymentDetail: payment === "CASH" ? null : paymentDetail || (payment === "MOBILE" ? "Telebirr" : "CBE"),
          items: cart,
          cashierName: "Abebe Owner",
        }),
      });
      if (!r.ok) throw new Error("checkout failed");
      return r.json();
    },
    onSuccess: (data) => {
      setLastSale({ number: data.sale.number, total });
      setCart([]);
      setPaymentDetail("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      toast.success(`Sale #${data.sale.number} complete`);
    },
    onError: () => toast.error("Could not complete sale"),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-40 pt-3">
      {/* Sale type toggle */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => { setSaleType("TAKE_HOME"); setCart([]); }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-3 text-left tap-scale transition-colors",
            saleType === "TAKE_HOME" ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-card/50"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold">OUT</span>
            <div>
              <p className="text-sm font-bold">Take Home</p>
              <p className="text-[10px] text-muted-foreground">Packed to go</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => { setSaleType("EAT_HERE"); setCart([]); }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-3 text-left tap-scale transition-colors",
            saleType === "EAT_HERE" ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card/50"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">IN</span>
            <div>
              <p className="text-sm font-bold">Eat Here</p>
              <p className="text-[10px] text-muted-foreground">Served on plate</p>
            </div>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meat…"
          className="h-10 w-full rounded-xl border border-border/70 bg-card/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filtered.map((p) => {
            const price = priceFor(p);
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p, 0.5)}
                onContextMenu={(e) => { e.preventDefault(); openKgMode(p); }}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-3 text-left tap-scale transition-all hover:border-primary/40",
                  colorFromString(p.name)
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">+0.5kg</span>
                </div>
                <p className="mt-2 text-sm font-bold text-foreground">{p.name}</p>
                <p className="text-sm font-bold tnum text-primary">{formatBirr(price)} <span className="text-[10px] font-normal text-muted-foreground">/kg</span></p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Tap to add 0.5 kg</p>
                <span
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); openKgMode(p); }}
                  className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-lg bg-background/70 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="custom weight"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14 M12 5v14" /></svg>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No products match.</div>
          )}
        </div>
      )}

      {/* Sticky cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[76px] z-30 mx-auto flex w-full max-w-2xl justify-center px-4">
          <Card className="w-full overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl card-raised">
            <div className="max-h-[60vh] overflow-y-auto mb-scroll">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Pill tone={saleType === "TAKE_HOME" ? "warn" : "good"}>{saleType === "TAKE_HOME" ? "Take Home" : "Eat Here"}</Pill>
                  <p className="text-xs text-muted-foreground">{cart.length} item{cart.length > 1 ? "s" : ""} · {totalKg.toFixed(2)} kg</p>
                </div>
                <button onClick={() => setCart([])} className="text-[11px] font-medium text-red-400 hover:text-red-300">Clear</button>
              </div>
              <div className="divide-y divide-border/40">
                {cart.map((i) => (
                  <div key={i.productId} className="flex items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground tnum">{formatBirr(i.unitPrice)} × {i.kg.toFixed(2)} kg</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustKg(i.productId, -0.5)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-foreground tap-scale">−</button>
                      <span className="w-12 text-center text-xs font-semibold tnum">{i.kg.toFixed(2)}</span>
                      <button onClick={() => adjustKg(i.productId, 0.5)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-foreground tap-scale">+</button>
                    </div>
                    <p className="w-20 text-right text-sm font-bold tnum">{formatBirr(i.total)}</p>
                    <button onClick={() => removeItem(i.productId)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border/60 bg-card/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="text-xl font-bold tnum text-primary">{formatBirr(total)}</span>
              </div>
              <div className="mb-2.5 grid grid-cols-3 gap-1.5">
                {(["CASH", "MOBILE", "BANK"] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setPayment(m); if (m === "CASH") setPaymentDetail(""); }}
                    className={cn(
                      "rounded-lg py-1.5 text-[11px] font-semibold tap-scale",
                      payment === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile" : "Bank"}
                  </button>
                ))}
              </div>
              {payment !== "CASH" && (
                <div className="mb-2.5">
                  <AccountProviderSelect
                    method={payment}
                    value={paymentDetail}
                    onChange={setPaymentDetail}
                  />
                </div>
              )}
              <button
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending || cart.length === 0}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground meat-glow disabled:opacity-50 tap-scale"
              >
                {checkout.isPending ? "Processing…" : `Complete Sale — ${formatBirr(total)}`}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Empty hint when cart is empty */}
      {cart.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /></svg>
          </div>
          <p className="text-sm font-semibold">Current Sale · {saleType === "TAKE_HOME" ? "Take Home" : "Eat Here"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tap a product to add 0.5 kg.</p>
        </div>
      )}

      {/* Last sale toast card */}
      {lastSale && (
        <div className="fixed inset-x-0 top-16 z-40 mx-auto flex w-full max-w-sm justify-center px-4">
          <Card className="w-full animate-in fade-in slide-in-from-top-4 bg-emerald-500/10 p-3 ring-1 ring-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Sale #{lastSale.number} complete</p>
                <p className="text-[11px] text-muted-foreground">{formatBirr(lastSale.total)} received</p>
              </div>
              <button onClick={() => setLastSale(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <button onClick={() => go("RECEIPTS")} className="mt-2 w-full rounded-lg bg-emerald-500/20 py-1.5 text-[11px] font-semibold text-emerald-300">View receipt</button>
          </Card>
        </div>
      )}

      {/* Custom kg dialog */}
      {kgMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3" onClick={() => setKgMode(null)}>
          <Card className="w-full max-w-sm rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{kgMode.name}</p>
                <p className="text-[11px] text-muted-foreground tnum">{formatBirr(kgMode.unitPrice)} / kg</p>
              </div>
              <button onClick={() => setKgMode(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">Enter weight in kg</p>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              step="0.01"
              value={customKg}
              onChange={(e) => setCustomKg(e.target.value)}
              placeholder="0.00"
              className="mb-3 h-12 w-full rounded-xl border border-border/60 bg-background/60 px-3 text-2xl font-bold tnum focus:border-primary/50 focus:outline-none"
            />
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {[0.25, 0.5, 1, 2].map((v) => (
                <button key={v} onClick={() => setCustomKg(String(v))} className="rounded-lg bg-muted/60 py-2 text-xs font-semibold tap-scale">{v} kg</button>
              ))}
            </div>
            <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2 text-right">
              <span className="text-[11px] text-muted-foreground">Total: </span>
              <span className="text-base font-bold tnum text-primary">{formatBirr(kgMode.unitPrice * (parseFloat(customKg) || 0))}</span>
            </div>
            <button onClick={confirmCustomKg} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground tap-scale">Add to sale</button>
          </Card>
        </div>
      )}
    </div>
  );
}
