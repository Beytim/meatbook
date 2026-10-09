"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav } from "@/lib/nav";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  PageScaffold, Pill, ListSkeleton, SectionHeader,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface License {
  licenseId: string;
  shopId: string;
  shopName: string;
  plan: string;
  status: string;
  daysRemaining: number;
  start: string;
  expiry: string;
}
interface LicenseResp { license: License }

// ─── View ───────────────────────────────────────────────────────────────
export function LicenseView() {
  const { back } = useNav();
  const qc = useQueryClient();
  const { t } = useLang();
  const [renewOpen, setRenewOpen] = React.useState(false);

  const { data, isLoading } = useQuery<LicenseResp>({
    queryKey: ["license"],
    queryFn: async () => {
      const r = await fetch("/api/meat/license");
      if (!r.ok) throw new Error("Failed to load license");
      return r.json();
    },
  });

  const license = data?.license;
  const isActive = license?.status === "Active" && (license?.daysRemaining ?? 0) > 0;
  const expiryDate = license?.expiry ? new Date(license.expiry) : null;
  const startDate = license?.start ? new Date(license.start) : null;

  return (
    <PageScaffold
      title={t("license.title")}
      subtitle={t("license.subtitle")}
      onBack={() => back()}
      right={
        <Button
          onClick={() => setRenewOpen(true)}
          size="sm"
          className="bg-primary text-primary-foreground meat-glow tap-scale"
        >
          <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.39 0 4.68.94 6.4 2.6" /><path d="M21 3v6h-6" />
          </svg>
          {t("license.renew")}
        </Button>
      }
    >
      {isLoading || !license ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          {/* Hero card */}
          <Card
            className={cn(
              "mb-5 overflow-hidden card-raised",
              isActive
                ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/20"
                : "bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent ring-1 ring-red-500/20",
            )}
          >
            <div className="flex items-center gap-4 p-5">
              <div
                className={cn(
                  "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
                  isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400",
                )}
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t("license.daysRemaining")}
                  </p>
                  <Pill tone={isActive ? "good" : "bad"}>
                    {license.status}
                  </Pill>
                </div>
                <p className="mt-1 text-4xl font-bold tracking-tight tnum">
                  {license.daysRemaining}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {expiryDate
                    ? `${t("license.title")} ${formatDate(expiryDate)}.`
                    : "—"}
                </p>
              </div>
            </div>
          </Card>

          {/* Details grid */}
          <div className="mb-3">
            <SectionHeader title={t("license.details")} subtitle={t("license.subtitle")} />
          </div>
          <Card className="mb-5 p-4 card-raised">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <DetailCell label={t("license.shopId")} value={license.shopId || "—"} mono />
              <DetailCell label={t("license.licenseId")} value={license.licenseId || "—"} mono />
              <DetailCell label={t("license.plan")} value={<Pill tone="primary">{license.plan || "Standard"}</Pill>} />
              <DetailCell
                label={t("common.status")}
                value={<Pill tone={isActive ? "good" : "bad"}>{license.status}</Pill>}
              />
            </div>

            <div className="my-4 h-px w-full bg-border/60" />

            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("license.period")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <DetailCell
                label={t("license.startDate")}
                value={startDate ? <span className="tnum">{formatDate(startDate)}</span> : "—"}
              />
              <DetailCell
                label={t("license.expiryDate")}
                value={expiryDate ? <span className="tnum">{formatDate(expiryDate)}</span> : "—"}
              />
              <DetailCell
                label={t("license.active")}
                value={
                  <Pill tone={isActive ? "good" : "bad"}>
                    {isActive ? t("common.yes") : t("common.no")}
                  </Pill>
                }
              />
              <DetailCell
                label={t("license.issued")}
                value={
                  <span className="tnum text-xs">
                    {startDate ? formatDateTime(startDate) : "—"}
                  </span>
                }
              />
            </div>
          </Card>

          {/* Renewal help card */}
          <Card className="p-4 card-raised bg-muted/30">
            <p className="text-sm font-semibold">{t("license.needRenew")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("license.renewHelp")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenewOpen(true)}
              className="mt-3 tap-scale"
            >
              {t("license.renew")}
            </Button>
          </Card>
        </>
      )}

      <RenewLicenseDialog
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["license"] })}
      />
    </PageScaffold>
  );
}

// ─── Detail cell ────────────────────────────────────────────────────────
function DetailCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-medium", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

// ─── Renew license dialog ───────────────────────────────────────────────
function RenewLicenseDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [key, setKey] = React.useState("");
  const qc = useQueryClient();
  const { t } = useLang();

  React.useEffect(() => {
    if (!open) setKey("");
  }, [open]);

  const renewMut = useMutation({
    mutationFn: async (k: string) => {
      const r = await fetch("/api/meat/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: k }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Invalid license key");
      return j as { ok: true; licenseExpiry: string };
    },
    onSuccess: (data) => {
      const d = data?.licenseExpiry ? new Date(data.licenseExpiry) : null;
      toast.success(d ? `${t("license.title")} ${formatDate(d)}` : t("license.title"));
      qc.invalidateQueries({ queryKey: ["license"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  const canSubmit = key.trim().length > 0 && !renewMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        {/* Header — fixed at top */}
        <DialogHeader className="shrink-0 border-b border-border/60 p-5 pb-4">
          <DialogTitle>{t("license.renew")}</DialogTitle>
          <DialogDescription>
            {t("license.dialogDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Middle — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="license-key" className="text-xs text-muted-foreground">
                {t("license.keyLabel")}
              </Label>
              <textarea
                id="license-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("license.keyPlaceholder")}
                rows={4}
                className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                {t("license.dialogHelp")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer — fixed at bottom */}
        <div className="flex shrink-0 gap-2 border-t border-border/60 bg-card p-4">
          <Button variant="outline" onClick={onClose} disabled={renewMut.isPending} className="flex-1">{t("common.cancel")}</Button>
          <Button
            onClick={() => renewMut.mutate(key.trim())}
            disabled={!canSubmit}
            className="flex-1 bg-primary text-primary-foreground"
          >
            {renewMut.isPending ? "…" : t("license.activate")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
