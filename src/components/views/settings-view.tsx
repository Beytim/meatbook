"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav, type ViewId } from "@/lib/nav";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  PageScaffold, SectionHeader, Pill, ListSkeleton,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface Settings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptHeader: string;
  receiptFooter: string;
  currency: string;
  licenseId: string;
  shopId: string;
  plan: string;
  licenseStart: string;
  licenseExpiry: string;
  lockEnabled: boolean;
  lockPin: string | null;
  autoBackup: boolean;
}
interface SettingsResp { settings: Settings }

// ─── Quick-link pills (top of Settings) ─────────────────────────────────
const QUICK_LINKS: { view: ViewId; labelKey: string; icon: React.ReactNode }[] = [
  {
    view: "STAFF",
    labelKey: "staff.title",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 11h6M19 8v6" />
      </svg>
    ),
  },
  {
    view: "BACKUP",
    labelKey: "backup.title",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
      </svg>
    ),
  },
  {
    view: "LICENSE",
    labelKey: "license.title",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
];

// Static payment methods (informational).
const PAYMENT_METHODS = [
  {
    code: "CASH",
    label: "Cash",
    tone: "good" as const,
    description: "Notes & coins accepted in person.",
  },
  {
    code: "MOBILE",
    label: "Mobile",
    tone: "primary" as const,
    description: "Telebirr, CBE Birr and similar wallets.",
  },
  {
    code: "BANK",
    label: "Bank",
    tone: "default" as const,
    description: "Direct bank transfer or deposit.",
  },
];

// Static default expense categories (informational).
const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Water", "Transport",
  "Salaries", "Supplies", "Maintenance", "Other",
];

// ─── View ───────────────────────────────────────────────────────────────
export function SettingsView() {
  const { back, go } = useNav();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { t } = useLang();

  const { data, isLoading } = useQuery<SettingsResp>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/meat/settings");
      if (!r.ok) throw new Error("Failed to load settings");
      return r.json();
    },
  });

  const settings = data?.settings;

  // ── Shop form state ──────────────────────────────────────────────────
  const [shop, setShop] = React.useState({
    shopName: "",
    shopPhone: "",
    shopAddress: "",
    receiptHeader: "",
    receiptFooter: "",
    currency: "Br",
  });
  const [shopDirty, setShopDirty] = React.useState(false);

  // ── Security form state ──────────────────────────────────────────────
  const [lockEnabled, setLockEnabled] = React.useState(false);
  const [lockPin, setLockPin] = React.useState("");
  const [securityDirty, setSecurityDirty] = React.useState(false);

  // Sync local form state once settings load.
  React.useEffect(() => {
    if (!settings) return;
    setShop({
      shopName: settings.shopName ?? "",
      shopPhone: settings.shopPhone ?? "",
      shopAddress: settings.shopAddress ?? "",
      receiptHeader: settings.receiptHeader ?? "",
      receiptFooter: settings.receiptFooter ?? "",
      currency: settings.currency ?? "Br",
    });
    setLockEnabled(!!settings.lockEnabled);
    setLockPin(settings.lockPin ?? "");
    setShopDirty(false);
    setSecurityDirty(false);
  }, [settings]);

  // ── Shop save mutation ───────────────────────────────────────────────
  const shopMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shop.shopName,
          shopPhone: shop.shopPhone,
          shopAddress: shop.shopAddress,
          receiptHeader: shop.receiptHeader,
          receiptFooter: shop.receiptFooter,
          currency: shop.currency,
        }),
      });
      if (!r.ok) throw new Error("Failed to save shop settings");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Shop settings saved");
      setShopDirty(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  // ── Security save mutation ───────────────────────────────────────────
  const securityMut = useMutation({
    mutationFn: async () => {
      const pinVal = lockPin.trim() ? lockPin.trim() : null;
      const r = await fetch("/api/meat/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockEnabled,
          lockPin: lockEnabled ? pinVal : null,
        }),
      });
      if (!r.ok) throw new Error("Failed to save security settings");
      return r.json();
    },
    onSuccess: () => {
      toast.success(lockEnabled ? "App lock enabled" : "App lock disabled");
      setSecurityDirty(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  const pinValid = lockPin === "" || /^\d{4}$/.test(lockPin.trim());
  const canSaveSecurity = pinValid && !securityMut.isPending;

  return (
    <PageScaffold
      title={t("settings.title")}
      subtitle="Shop, payments, expenses, appearance & security"
      onBack={() => back()}
    >
      {/* Quick-link pills */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {QUICK_LINKS.map((q) => (
          <Card key={q.view} className="card-raised">
            <button
              type="button"
              onClick={() => go(q.view)}
              className="tap-scale flex w-full flex-col items-center gap-1.5 p-3 text-center"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                {q.icon}
              </span>
              <span className="text-xs font-medium">{t(q.labelKey)}</span>
            </button>
          </Card>
        ))}
      </div>

      {isLoading || !settings ? (
        <ListSkeleton rows={6} />
      ) : (
        <>
          {/* ── Shop section ─────────────────────────────────────────── */}
          <div className="mb-3">
            <SectionHeader title={t("settings.shop")} subtitle="Identity, contact & receipt branding" />
          </div>
          <Card className="mb-5 p-4 card-raised">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Shop Identity
            </p>
            <div className="mt-3 space-y-3">
              <Field label={t("settings.shopName")}>
                <Input
                  value={shop.shopName}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, shopName: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="Kera Fresh Meat Shop"
                />
              </Field>
              <Field label={t("settings.shopPhone")}>
                <Input
                  value={shop.shopPhone}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, shopPhone: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="+251 911 000 000"
                />
              </Field>
              <Field label={t("settings.shopAddress")}>
                <Input
                  value={shop.shopAddress}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, shopAddress: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="Kera, Addis Ababa, Ethiopia"
                />
              </Field>
            </div>

            <Separator className="my-4" />

            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("settings.receipt")}
            </p>
            <div className="mt-3 space-y-3">
              <Field label={t("settings.receiptHeader")}>
                <Input
                  value={shop.receiptHeader}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, receiptHeader: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="Kera Fresh Meat Shop"
                />
              </Field>
              <Field label={t("settings.receiptFooter")}>
                <Textarea
                  value={shop.receiptFooter}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, receiptFooter: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="Thank you! Meat sold by kg. Keep refrigerated."
                  className="min-h-20"
                />
              </Field>
              <Field label={t("settings.currency")}>
                <Input
                  value={shop.currency}
                  onChange={(e) => {
                    setShop((s) => ({ ...s, currency: e.target.value }));
                    setShopDirty(true);
                  }}
                  placeholder="Br"
                  className="max-w-24"
                />
              </Field>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => shopMut.mutate()}
                disabled={!shopDirty || shopMut.isPending}
                className="bg-primary text-primary-foreground"
              >
                {shopMut.isPending ? "Saving…" : "Save shop settings"}
              </Button>
            </div>
          </Card>

          {/* ── Appearance section ───────────────────────────────────── */}
          <div className="mb-3">
            <SectionHeader title={t("settings.appearance")} subtitle="Theme & visual mode" />
          </div>
          <Card className="mb-5 p-4 card-raised">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Theme</p>
                <p className="text-xs text-muted-foreground">
                  Currently using {theme === "dark" ? "Dark" : "Light"} mode.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ThemeButton
                active={theme === "dark"}
                onClick={() => setTheme("dark")}
                label={t("settings.darkTheme")}
                description="Charcoal + Meat Red"
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                }
              />
              <ThemeButton
                active={theme === "light"}
                onClick={() => setTheme("light")}
                label={t("settings.lightTheme")}
                description="Bright & airy"
                icon={
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                }
              />
            </div>
          </Card>

          {/* ── Security section ─────────────────────────────────────── */}
          <div className="mb-3">
            <SectionHeader title="Security" subtitle="App lock & PIN" />
          </div>
          <Card className="mb-5 p-4 card-raised">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Lock</p>
                <p className="text-xs text-muted-foreground">
                  Require a PIN when the app opens.
                </p>
              </div>
              <Switch
                checked={lockEnabled}
                onCheckedChange={(v) => {
                  setLockEnabled(v);
                  setSecurityDirty(true);
                }}
              />
            </div>

            {lockEnabled && (
              <div className="mt-4">
                <Field label="Lock PIN (4 digits)">
                  <Input
                    value={lockPin}
                    onChange={(e) => {
                      setLockPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                      setSecurityDirty(true);
                    }}
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    className="tnum max-w-32"
                  />
                </Field>
                {!pinValid && (
                  <p className="mt-1.5 text-[11px] text-red-400">PIN must be exactly 4 digits.</p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => securityMut.mutate()}
                disabled={!securityDirty || !canSaveSecurity}
                className="bg-primary text-primary-foreground"
              >
                {securityMut.isPending ? "Saving…" : "Save security settings"}
              </Button>
            </div>
          </Card>

          {/* ── Payments section (informational) ─────────────────────── */}
          <div className="mb-3">
            <SectionHeader title={t("settings.payments")} subtitle="Accepted payment methods" />
          </div>
          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {PAYMENT_METHODS.map((m) => (
              <Card key={m.code} className="p-3 card-raised">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold">{m.label}</span>
                  <Pill tone={m.tone}>{m.code}</Pill>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {m.description}
                </p>
              </Card>
            ))}
          </div>

          {/* ── Expenses section (informational) ─────────────────────── */}
          <div className="mb-3">
            <SectionHeader title={t("settings.expenses")} subtitle="Default expense categories" />
          </div>
          <Card className="mb-5 p-4 card-raised">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Record expenses against any of these categories or type your own when adding an expense.
            </p>
          </Card>
        </>
      )}
    </PageScaffold>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ─── Theme button ───────────────────────────────────────────────────────
function ThemeButton({
  active,
  onClick,
  label,
  description,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-scale flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : "border-border/70 bg-card/60 hover:bg-muted/50",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
