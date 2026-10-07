"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatBytes, formatDateTime, relativeDay,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  PageScaffold, StatTile, ListSkeleton, SectionHeader, Pill,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
interface DeviceResp {
  dbSize: number;
  dbPath: string;
  quota: number;
  used: number;
  free: number;
  lastBackup: { createdAt: string; size: number } | null;
  backupHealth: "Critical" | "Healthy";
}

// ─── View ───────────────────────────────────────────────────────────────
export function DeviceView() {
  const { back, go } = useNav();

  const { data, isLoading } = useQuery<DeviceResp>({
    queryKey: ["device"],
    queryFn: async () => {
      const r = await fetch("/api/meat/device");
      if (!r.ok) throw new Error("Failed to load device status");
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <PageScaffold title="Device & Storage" subtitle="Health, storage and database status" onBack={() => back()}>
        <ListSkeleton rows={5} />
      </PageScaffold>
    );
  }

  const dbSize = data?.dbSize ?? 0;
  const dbPath = data?.dbPath ?? "/home/z/my-project/db/custom.db";
  const quota = data?.quota ?? 10 * 1024 * 1024 * 1024;
  const used = data?.used ?? dbSize;
  const free = data?.free ?? Math.max(0, quota - used);
  const lastBackup = data?.lastBackup ?? null;
  const backupHealth = data?.backupHealth ?? "Critical";

  const usedPct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const dbPct = quota > 0 ? Math.min(100, (dbSize / quota) * 100) : 0;
  const isCritical = backupHealth === "Critical";

  return (
    <PageScaffold
      title="Device & Storage"
      subtitle="Health, storage and database status"
      onBack={() => back()}
    >
      {/* Health hero card */}
      <Card
        className={cn(
          "mb-5 overflow-hidden card-raised",
          isCritical
            ? "bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent ring-1 ring-red-500/20"
            : "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/20",
        )}
      >
        <div className="flex items-center gap-4 p-5">
          <div
            className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
              isCritical ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400",
            )}
          >
            {isCritical ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">
              {isCritical ? "Backup health is critical" : "Storage is healthy"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCritical
                ? "No backup in over 7 days — or never backed up. Back up immediately."
                : "Storage is healthy."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tnum">
              {formatBytes(used)} used · {formatBytes(free)} free
            </p>
          </div>
        </div>
      </Card>

      {/* Status tiles */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatTile
          label="Available Storage"
          value={<span className="tnum">{formatBytes(free)}</span>}
          sub={`${formatBytes(quota)} total`}
          tone="good"
        />
        <StatTile
          label="Database Size"
          value={<span className="tnum">{formatBytes(dbSize)}</span>}
          sub="SQLite file"
        />
        <StatTile
          label="Last Backup"
          value={lastBackup ? <span className="tnum">{relativeDay(lastBackup.createdAt)}</span> : "—"}
          sub={lastBackup ? formatDateTime(lastBackup.createdAt) : "Never"}
        />
        <StatTile
          label="Backup Health"
          value={isCritical ? "Critical" : "Healthy"}
          sub={
            isCritical ? (
              <button onClick={() => go("BACKUP")} className="text-red-400 underline-offset-2 hover:underline">
                Back up now
              </button>
            ) : (
              "Up to date"
            )
          }
          tone={isCritical ? "bad" : "good"}
        />
      </div>

      {/* Storage breakdown card */}
      <div className="mb-3">
        <SectionHeader title="Storage Breakdown" subtitle="Quota usage and database footprint" />
      </div>
      <Card className="mb-5 p-4 card-raised">
        {/* Used vs Free horizontal bar */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quota usage</p>
          <p className="text-xs text-muted-foreground tnum">
            {usedPct.toFixed(2)}% used
          </p>
        </div>
        <div className="relative mb-1 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${Math.max(0.5, usedPct)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tnum">
          <span>{formatBytes(used)} used</span>
          <span>{formatBytes(free)} free of {formatBytes(quota)}</span>
        </div>

        <div className="mt-4 space-y-2.5">
          <Row label="Database file size" value={<span className="tnum">{formatBytes(dbSize)}</span>} />
          <Row label="DB path" value={<span className="truncate font-mono text-[11px]">{dbPath}</span>} />
          <Row label="Used by DB" value={<span className="tnum">{dbPct.toFixed(4)}%</span>} />
          <Row
            label="Last backup records"
            value={lastBackup ? <span className="tnum">{relativeDay(lastBackup.createdAt)}</span> : <span className="text-muted-foreground">None</span>}
          />
          <Row
            label="Last backup size"
            value={lastBackup ? <span className="tnum">{formatBytes(lastBackup.size)}</span> : <span className="text-muted-foreground">—</span>}
          />
        </div>

        <p className="mt-4 rounded-lg bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Estimates come from your browser&apos;s Storage API. Use the Backup screen to download a portable <span className="font-mono">.mbk</span> file you can store anywhere.
        </p>
      </Card>

      {/* Backup health detail card (only show if critical) */}
      {isCritical && (
        <>
          <div className="mb-3">
            <SectionHeader title="Backup Health" subtitle="Action required" />
          </div>
          <Card className="mb-5 overflow-hidden card-raised bg-red-500/5 ring-1 ring-red-500/20">
            <div className="flex items-start gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/20 text-red-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">Backup health: Critical</p>
                  <Pill tone="bad">Action needed</Pill>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No backup in over 7 days — or never backed up. Back up immediately to avoid losing sales, products, and reports.
                </p>
                <Button
                  onClick={() => go("BACKUP")}
                  className="mt-3 bg-red-500 text-white hover:bg-red-600 tap-scale"
                  size="sm"
                >
                  <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
                  </svg>
                  Backup
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </PageScaffold>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}
