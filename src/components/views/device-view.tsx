"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNav } from "@/lib/nav";
import {
  cn, formatBytes, formatDateTime, relativeDay,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PageScaffold, StatTile, ListSkeleton, SectionHeader, Pill,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface RecordCounts {
  sales: number; products: number; customers: number; suppliers: number; staff: number;
  purchases: number; expenses: number; wastage: number; debts: number; ledgerEntries: number;
  cashSessions: number; moneyMoves: number; auditLogs?: number; backups: number;
  total: number;
}
interface DeviceResp {
  dbSize: number;
  appDataSize: number;
  backupDirSize: number;
  backupFileCount: number;
  lastBackup: { createdAt: string; size: number } | null;
  backupHealth: "Critical" | "Healthy";
  recordCounts?: RecordCounts;
  appVersion: string;
  appBuild: string;
}

// ─── View ───────────────────────────────────────────────────────────────
export function DeviceView() {
  const { back, go } = useNav();
  const { t } = useLang();

  const { data, isLoading, isFetching, refetch } = useQuery<DeviceResp>({
    queryKey: ["device"],
    queryFn: async () => {
      const r = await fetch("/api/meat/device");
      if (!r.ok) throw new Error("Failed to load device status");
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <PageScaffold title={t("device.title")} subtitle={t("device.title")} onBack={() => back()}>
        <ListSkeleton rows={4} />
      </PageScaffold>
    );
  }

  const dbSize = data?.dbSize ?? 0;
  const appDataSize = data?.appDataSize ?? dbSize;
  const backupDirSize = data?.backupDirSize ?? 0;
  const backupFileCount = data?.backupFileCount ?? 0;
  const lastBackup = data?.lastBackup ?? null;
  const backupHealth = data?.backupHealth ?? "Critical";
  const counts = data?.recordCounts;
  const appVersion = data?.appVersion ?? "1.0.0";
  const appBuild = data?.appBuild ?? "—";

  const dbPctOfApp = appDataSize > 0 ? (dbSize / appDataSize) * 100 : 0;
  const isCritical = backupHealth === "Critical";

  return (
    <PageScaffold
      title={t("device.title")}
      subtitle={t("device.title")}
      onBack={() => back()}
      right={
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="tap-scale"
        >
          <svg viewBox="0 0 24 24" className={cn("h-4 w-4", isFetching && "animate-spin")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" /><path d="M21 3v6h-6" />
          </svg>
          {t("common.save")}
        </Button>
      }
    >
      {/* Quick link to Backup & Restore */}
      <Card
        className={cn(
          "mb-5 overflow-hidden card-raised",
          isCritical
            ? "bg-red-500/5 ring-1 ring-red-500/20"
            : "bg-emerald-500/5 ring-1 ring-emerald-500/20",
        )}
      >
        <button onClick={() => go("BACKUP")} className="flex w-full items-center gap-3 p-4 text-left tap-scale">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
              isCritical ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400",
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {isCritical ? "Backup needed" : "Backups healthy"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isCritical
                ? "No backup in 7+ days. Go to Backup & Restore →"
                : lastBackup
                ? `Last backup ${relativeDay(lastBackup.createdAt)} · ${formatBytes(lastBackup.size)}`
                : "Go to Backup & Restore to create your first backup →"}
            </p>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </Card>

      {/* App data stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatTile
          label={t("device.appData")}
          value={<span className="tnum">{formatBytes(appDataSize)}</span>}
          sub={`DB ${formatBytes(dbSize)} + backups ${formatBytes(backupDirSize)}`}
          tone="primary"
        />
        <StatTile
          label={t("audit.totalEvents")}
          value={<span className="tnum">{counts?.total ?? 0}</span>}
          sub="across all tables"
        />
      </div>

      {/* App Data Breakdown */}
      <div className="mb-3">
        <SectionHeader title={t("device.appData")} subtitle={t("device.title")} />
      </div>
      <Card className="mb-5 p-4 card-raised">
        {/* App data composition: DB vs Backups */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("device.appData")}</p>
          <p className="text-xs text-muted-foreground tnum">
            {formatBytes(appDataSize)} total
          </p>
        </div>
        {/* Stacked bar: DB portion vs Backup portion */}
        <div className="relative mb-1 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-primary"
            style={{ width: `${Math.max(0.5, dbPctOfApp)}%` }}
          />
          {backupDirSize > 0 && (
            <div
              className="absolute inset-y-0 rounded-r-full bg-amber-400"
              style={{ left: `${dbPctOfApp}%`, width: `${Math.max(0.5, 100 - dbPctOfApp)}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tnum">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> DB: {formatBytes(dbSize)} ({dbPctOfApp.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Backups: {formatBytes(backupDirSize)} ({(100 - dbPctOfApp).toFixed(1)}%)
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          <Row label={t("device.appData")} value={<span className="tnum font-semibold">{formatBytes(appDataSize)}</span>} />
          <Row label={t("backup.databaseSize")} value={<span className="tnum">{formatBytes(dbSize)}</span>} />
          <Row label={t("backup.history")} value={<span className="tnum">{formatBytes(backupDirSize)} · {backupFileCount} {backupFileCount === 1 ? "file" : "files"}</span>} />
          <Row
            label={t("backup.lastBackup")}
            value={lastBackup ? <span className="tnum">{relativeDay(lastBackup.createdAt)} · {formatBytes(lastBackup.size)}</span> : <span className="text-muted-foreground">None</span>}
          />
        </div>

        <p className="mt-4 rounded-lg bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          MeatBook stores all data locally on this device (offline-first). Use <button onClick={() => go("BACKUP")} className="font-medium text-primary underline-offset-2 hover:underline">Backup &amp; Restore</button> to download a portable <span className="font-mono">.mbk</span> file you can store anywhere.
        </p>
      </Card>

      {/* App info */}
      <div className="mb-3">
        <SectionHeader title={t("device.appInfo")} subtitle={t("device.appVersion")} />
      </div>
      <Card className="mb-5 p-4 card-raised">
        <div className="space-y-2.5">
          <Row label={t("device.appVersion")} value={<span className="tnum font-mono">v{appVersion}</span>} />
          <Row label={t("device.appVersion")} value={<span className="tnum font-mono">{appBuild}</span>} />
          <Row label={t("device.storageMode")} value={<span className="text-[11px]">Offline-first (local database)</span>} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => go("BACKUP")}
            variant="outline"
            size="sm"
            className="flex-1 tap-scale"
          >
            <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
            </svg>
            {t("common.backup")}
          </Button>
          <Button
            onClick={() => go("SETTINGS")}
            variant="outline"
            size="sm"
            className="flex-1 tap-scale"
          >
            <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {t("settings.title")}
          </Button>
        </div>
      </Card>

      {/* Backup health detail card (only show if critical) */}
      {isCritical && (
        <>
          <div className="mb-3">
            <SectionHeader title={t("backup.status")} subtitle="Action required" />
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
                  <p className="text-sm font-semibold">{t("backup.status")}: Critical</p>
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
                  {t("common.backup")}
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
