"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatBirr, cn, colorFromString } from "@/lib/utils";
import { useNav } from "@/lib/nav";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill } from "@/components/app/primitives";
import { AccountProviderSelect } from "@/components/app/account-provider-select";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from "@/components/ui/drawer";

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
type PaymentMethod = "CASH" | "MOBILE" | "BANK" | "CREDIT";

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
  const [cartOpen, setCartOpen] = React.useState(false);
  const [lastSale, setLastSale] = React.useState<{ number: string; total: number } | null>(null);
  // Cash received + change
  const [cashReceived, setCashReceived] = React.useState("");
  // Discount
  const [discount, setDiscount] = React.useState("");
  // Credit sale: customer selector
  const [customerId, setCustomerId] = React.useState("");
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [customers, setCustomers] = React.useState<{ id: string; name: string }[]>([]);

  const fetchCustomers = React.useCallback(async () => {
    try {
      const r = await fetch("/api/meat/customers");
      const d = await r.json();
      setCustomers(d.customers ?? []);
    } catch { /* ignore */ }
  }, []);

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
    // subtle feedback pulse on the FAB
    setFabPulse(true);
    window.setTimeout(() => setFabPulse(false), 350);
  };

  const [fabPulse, setFabPulse] = React.useState(false);

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
  const cartInCart = (productId: string) => cart.some((i) => i.productId === productId);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const totalKg = cart.reduce((s, i) => s + i.kg, 0);
  // Discount: if ends with % it's percentage, otherwise flat amount
  const discountNum = parseFloat(discount) || 0;
  const discountAmount = discount.endsWith("%")
    ? Math.round((subtotal * discountNum / 100) * 100) / 100
    : discountNum;
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  // Cash change
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = Math.max(0, Math.round((cashReceivedNum - total) * 100) / 100);

  const checkout = useMutation({
    mutationFn: async () => {
      // For credit sales, resolve/create the customer first
      let custId = customerId;
      if (payment === "CREDIT" && !custId && newCustomerName.trim()) {
        const cr = await fetch("/api/meat/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCustomerName.trim() }),
        });
        const cd = await cr.json();
        custId = cd.customer.id;
      }
      const r = await fetch("/api/meat/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: saleType,
          paymentMethod: payment === "CREDIT" ? "CREDIT" : payment,
          paymentDetail: payment === "CASH" ? null : payment === "CREDIT" ? null : paymentDetail || (payment === "MOBILE" ? "Telebirr" : "CBE"),
          items: cart.map((i) => ({ ...i, total: discountAmount > 0 ? Math.round(i.total * (total / subtotal) * 100) / 100 : i.total })),
          cashierName: "Abebe Owner",
          discount: discountAmount > 0 ? discountAmount : undefined,
          // Credit sale: pass customer info so the API creates a debt
          creditCustomerId: payment === "CREDIT" ? custId : undefined,
          creditCustomerName: payment === "CREDIT" ? (customers.find(c => c.id === custId)?.name || newCustomerName.trim()) : undefined,
        }),
      });
      if (!r.ok) throw new Error("checkout failed");
      return r.json();
    },
    onSuccess: (data) => {
      setLastSale({ number: data.sale.number, total });
      setCart([]);
      setPaymentDetail("");
      setCustomerId("");
      setNewCustomerName("");
      setCashReceived("");
      setDiscount("");
      setCartOpen(false);
      // Invalidate EVERY module so the whole app stays in sync
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["money"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast.success(`Sale #${data.sale.number} complete`);
    },
    onError: () => toast.error("Could not complete sale"),
  });

  // Shared cart content (used in both desktop side panel and mobile drawer)
  const cartContent = (
    <>
      {/* Items list */}
      <div className="mb-scroll max-h-[30vh] overflow-y-auto px-2 py-2">
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cart is empty. Tap a product to add.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {cart.map((i) => (
              <div key={i.productId} className="flex items-center gap-2 px-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{i.name}</p>
                  <p className="text-[11px] text-muted-foreground tnum">{formatBirr(i.unitPrice)} × {i.kg.toFixed(2)} kg</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => adjustKg(i.productId, -0.5)} className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground tap-scale" aria-label="decrease">−</button>
                  <span className="w-14 text-center text-sm font-bold tnum">{i.kg.toFixed(2)}</span>
                  <button onClick={() => adjustKg(i.productId, 0.5)} className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground tap-scale" aria-label="increase">+</button>
                </div>
                <p className="w-20 text-right text-sm font-bold tnum">{formatBirr(i.total)}</p>
                <button onClick={() => removeItem(i.productId)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400" aria-label="remove">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discount + Total + Payment */}
      {cart.length > 0 && (
        <div className="border-t border-border/60 bg-card/80 p-3 space-y-2">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Discount</span>
            <input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
              placeholder="0 or 10%"
              className="h-8 w-24 rounded-lg border border-border/60 bg-background/60 px-2 text-xs tnum text-right"
            />
            {discountAmount > 0 && <span className="text-[11px] text-red-400 tnum">−{formatBirr(discountAmount)}</span>}
          </div>

          {/* Subtotal + Total */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Subtotal</span>
            <span className="text-sm tnum text-muted-foreground">{formatBirr(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="text-xl font-bold tnum text-primary">{formatBirr(total)}</span>
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-4 gap-1.5">
            {(["CASH", "MOBILE", "BANK", "CREDIT"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => { setPayment(m); setPaymentDetail(""); if (m === "CREDIT") fetchCustomers(); }}
                className={cn("rounded-lg py-2 text-[11px] font-semibold tap-scale", payment === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}
              >
                {m === "CASH" ? "Cash" : m === "MOBILE" ? "Mobile" : m === "BANK" ? "Bank" : "Credit"}
              </button>
            ))}
          </div>

          {/* Bank/Mobile provider dropdown */}
          {payment !== "CASH" && payment !== "CREDIT" && (
            <div className="relative z-50">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{payment === "MOBILE" ? "Provider" : "Bank"}</p>
              <AccountProviderSelect method={payment} value={paymentDetail} onChange={setPaymentDetail} />
            </div>
          )}

          {/* Cash received + change calculator */}
          {payment === "CASH" && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cash Received</p>
              <input
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                inputMode="decimal"
                placeholder={String(total)}
                className="h-9 w-full rounded-lg border border-border/60 bg-background/60 px-3 text-sm tnum text-right focus:border-primary/50 focus:outline-none"
              />
              {cashReceivedNum > 0 && (
                <div className="mt-1.5 flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">Change</span>
                  <span className={cn("text-base font-bold tnum", change >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {change >= 0 ? formatBirr(change) : `Short ${formatBirr(total - cashReceivedNum)}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Credit customer selector */}
          {payment === "CREDIT" && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer (Credit)</p>
              {customers.length > 0 && (
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mb-1.5 h-9 w-full rounded-lg border border-border/60 bg-background/60 px-2 text-sm">
                  <option value="">— Select existing customer —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="…or type new customer name" className="h-9 w-full rounded-lg border border-border/60 bg-background/60 px-3 text-sm" />
            </div>
          )}

          {/* Checkout buttons */}
          <div className="flex gap-2">
            <button onClick={() => { setCart([]); setDiscount(""); setCashReceived(""); }} className="rounded-xl bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-400 tap-scale">Clear</button>
            <button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending || cart.length === 0 || (payment !== "CASH" && payment !== "CREDIT" && !paymentDetail) || (payment === "CREDIT" && !customerId && !newCustomerName.trim())}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground meat-glow disabled:opacity-50 tap-scale"
            >
              {checkout.isPending ? "Processing…" : `Complete — ${formatBirr(total)}`}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-3">
      <div className="flex gap-4">
        {/* Left: Products (takes most space) */}
        <div className="flex-1 min-w-0">
          {/* Sale type toggle */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => { setSaleType("TAKE_HOME"); }}
              className={cn("relative overflow-hidden rounded-2xl border p-3 text-left tap-scale transition-colors", saleType === "TAKE_HOME" ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-card/50")}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold">OUT</span>
                <div><p className="text-sm font-bold">Take Home</p><p className="text-[10px] text-muted-foreground">Packed to go</p></div>
              </div>
            </button>
            <button
              onClick={() => { setSaleType("EAT_HERE"); }}
              className={cn("relative overflow-hidden rounded-2xl border p-3 text-left tap-scale transition-colors", saleType === "EAT_HERE" ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card/50")}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">IN</span>
                <div><p className="text-sm font-bold">Eat Here</p><p className="text-[10px] text-muted-foreground">Served on plate</p></div>
              </div>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meat…" className="h-10 w-full rounded-xl border border-border/70 bg-card/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20" />
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
                  <button key={p.id} onClick={() => addToCart(p, 0.5)}
                    className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left tap-scale transition-all hover:border-primary/40",
                      cartInCart(p.id) ? "border-primary/50 ring-1 ring-primary/30" : "border-border/60", colorFromString(p.name))}>
                    {cartInCart(p.id) && (
                      <span className="absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground z-10">
                        {cart.find((i) => i.productId === p.id)?.kg.toFixed(1)}kg
                      </span>
                    )}
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{p.emoji}</span>
                      {!cartInCart(p.id) && <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">+0.5kg</span>}
                    </div>
                    <p className="mt-2 text-sm font-bold text-foreground">{p.name}</p>
                    <p className="text-sm font-bold tnum text-primary">{formatBirr(price)} <span className="text-[10px] font-normal text-muted-foreground">/kg</span></p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{cartInCart(p.id) ? "In cart — tap to add more" : "Tap to add 0.5 kg"}</p>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No products match.</div>}
            </div>
          )}
        </div>

        {/* Right: Desktop side panel cart (hidden on mobile) */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col">
          <Card className="card-raised bg-card flex h-[calc(100vh-180px)] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="flex items-center gap-2">
                <Pill tone={saleType === "TAKE_HOME" ? "warn" : "good"}>{saleType === "TAKE_HOME" ? "Take Home" : "Eat Here"}</Pill>
                <span className="text-sm font-bold">Current Sale</span>
              </span>
              <span className="text-xs text-muted-foreground tnum">{cart.length} item{cart.length > 1 ? "s" : ""} · {totalKg.toFixed(2)} kg</span>
            </div>
            {cartContent}
          </Card>
        </div>
      </div>

      {/* Mobile: Floating cart FAB */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className={cn("fixed bottom-[88px] right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl meat-glow tap-scale transition-transform lg:hidden", fabPulse && "scale-110")}
          aria-label="Open cart"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1.6" /><circle cx="18" cy="21" r="1.6" /><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
          </svg>
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-black ring-2 ring-background">{cart.length}</span>
          <span className="absolute -bottom-5 whitespace-nowrap rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold tnum text-primary ring-1 ring-border/60">{formatBirr(total)}</span>
        </button>
      )}

      {/* Mobile: Cart drawer */}
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="mx-auto max-h-[92vh] max-w-2xl rounded-t-3xl border-border/70 bg-background lg:hidden">
          <DrawerHeader className="border-b border-border/60 px-4 pb-3">
            <DrawerTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Pill tone={saleType === "TAKE_HOME" ? "warn" : "good"}>{saleType === "TAKE_HOME" ? "Take Home" : "Eat Here"}</Pill>
                <span className="text-sm font-bold">Current Sale</span>
              </span>
              <span className="text-xs text-muted-foreground tnum">{cart.length} item{cart.length > 1 ? "s" : ""} · {totalKg.toFixed(2)} kg</span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="mb-scroll flex max-h-[calc(92vh-60px)] flex-col overflow-y-auto">
            {cartContent}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Last sale toast */}
      {lastSale && (
        <div className="fixed inset-x-0 top-16 z-[60] mx-auto flex w-full max-w-sm justify-center px-4">
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
    </div>
  );
}
