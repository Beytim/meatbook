"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav } from "@/lib/nav";
import {
  cn, formatBytes, formatDateTime, relativeDay,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  PageScaffold, StatTile, EmptyState, Pill, ListSkeleton, SectionHeader,
} from "@/components/app/primitives";
import { useLang } from "@/components/lang-provider";

// ─── Types ──────────────────────────────────────────────────────────────
interface BackupRecord {
  id: string;
  size: number;
  note: string | null;
  createdAt: string;
}
interface BackupResp {
  backups: BackupRecord[];
  dbSize: number;
  lastBackup: BackupRecord | null;
}
interface SettingsResp {
  settings: {
    autoBackup: boolean;
    shopName: string;
  };
}

// 10 GB quota — mirrors /api/meat/device
const QUOTA = 10 * 1024 * 1024 * 1024;

// ─── View ───────────────────────────────────────────────────────────────
export function BackupView() {
  const { back, go } = useNav();
  const qc = useQueryClient();
  const { t } = useLang();

  const { data, isLoading } = useQuery<BackupResp>({
    queryKey: ["backups"],
    queryFn: async () => {
      const r = await fetch("/api/meat/backup");
      if (!r.ok) throw new Error("Failed to load backup status");
      return r.json();
    },
  });

  const { data: settingsData } = useQuery<SettingsResp>({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/meat/settings");
      if (!r.ok) throw new Error("Failed to load settings");
      return r.json();
    },
    staleTime: 30_000,
  });

  const dbSize = data?.dbSize ?? 0;
  const backups = data?.backups ?? [];
  const lastBackup = data?.lastBackup ?? null;
  const autoBackup = settingsData?.settings.autoBackup ?? false;

  // health: critical if no backup in over 7 days (or never)
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const lastTs = lastBackup ? new Date(lastBackup.createdAt).getTime() : 0;
  const isCritical = !lastBackup || lastTs < sevenDaysAgo;
  const freeSpace = Math.max(0, QUOTA - dbSize);

  const invalidateAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ["backups"] });
    qc.invalidateQueries({ queryKey: ["device"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }, [qc]);

  // ── Snapshot mutation ────────────────────────────────────────────────
  const snapshotMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SNAPSHOT", note: "Manual snapshot" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Snapshot failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Backup created");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  // ── Export mutation ──────────────────────────────────────────────────
  const exportMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/meat/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXPORT" }),
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      // Try to read filename from Content-Disposition
      const disp = r.headers.get("Content-Disposition") || "";
      const m = /filename="?([^";]+)"?/.exec(disp);
      const filename = m?.[1] || `meatbook-${Date.now()}.mbk`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Backup file downloaded"),
    onError: (err: Error) => toast.error(err.message || "Export failed"),
  });

  // ── Restore (file input) ─────────────────────────────────────────────
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
    // reset input so the same file can be re-selected
    e.target.value = "";
  };

  const restoreMut = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      // Convert ArrayBuffer → base64
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const data = btoa(binary);
      const r = await fetch("/api/meat/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE", data }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Restore failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Backup restored");
      setPendingFile(null);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message || "Restore failed"),
  });

  // ── Auto backup toggle ───────────────────────────────────────────────
  const toggleAutoMut = useMutation({
    mutationFn: async (next: boolean) => {
      const r = await fetch("/api/meat/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoBackup: next }),
      });
      if (!r.ok) throw new Error("Failed to update setting");
      return r.json();
    },
    onMutate: (next) => {
      qc.setQueryData<SettingsResp>(["settings"], (old) =>
        old ? { ...old, settings: { ...old.settings, autoBackup: next } } : old,
      );
    },
    onSuccess: () => toast.success("Setting saved"),
    onError: (err: Error) => {
      toast.error(err.message || "Failed");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <PageScaffold
      title={t("backup.title")}
      subtitle={t("backup.subtitle")}
      onBack={() => back()}
    >
      {/* Hero backup button */}
      <Card className="mb-5 overflow-hidden card-raised bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="flex items-center gap-4 p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{t("backup.now")}</p>
            <p className="text-xs text-muted-foreground">
              Snapshot your current database into a recoverable backup.
            </p>
          </div>
          <Button
            onClick={() => snapshotMut.mutate()}
            disabled={snapshotMut.isPending}
            className="bg-primary text-primary-foreground meat-glow shrink-0 tap-scale"
          >
            {snapshotMut.isPending ? "Working…" : t("backup.now")}
          </Button>
        </div>
      </Card>

      {/* Status tiles */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatTile
          label={t("backup.databaseSize")}
          value={<span className="tnum">{formatBytes(dbSize)}</span>}
          sub="SQLite file"
        />
        <StatTile
          label={t("backup.lastBackup")}
          value={lastBackup ? <span className="tnum">{relativeDay(lastBackup.createdAt)}</span> : "—"}
          sub={lastBackup ? formatDateTime(lastBackup.createdAt) : "Never"}
        />
        <StatTile
          label={t("backup.status")}
          value={isCritical ? "Critical" : "Healthy"}
          sub={isCritical ? "No recent backup" : "Up to date"}
          tone={isCritical ? "bad" : "good"}
        />
        <StatTile
          label="Available Storage"
          value={<span className="tnum">{formatBytes(freeSpace)} / {formatBytes(QUOTA)}</span>}
          sub="Storage is healthy"
          tone="good"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-3">
        <SectionHeader title={t("home.quickActions")} subtitle="Snapshot, export, or restore your data" />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <ActionCard
          tone="primary"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
            </svg>
          }
          title={t("backup.now")}
          description={t("backup.snapshotDesc")}
          onClick={() => snapshotMut.mutate()}
          disabled={snapshotMut.isPending}
          loading={snapshotMut.isPending}
        />
        <ActionCard
          tone="good"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
            </svg>
          }
          title={t("backup.export")}
          description={t("backup.exportDesc")}
          onClick={() => exportMut.mutate()}
          disabled={exportMut.isPending}
          loading={exportMut.isPending}
        />
        <ActionCard
          tone="warn"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
            </svg>
          }
          title={t("backup.import")}
          description={t("backup.importDesc")}
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mbk,application/octet-stream"
        className="hidden"
        onChange={onFileSelected}
      />

      {/* Automatic daily backup toggle */}
      <Card className="mb-5 flex items-center gap-3 p-4 card-raised">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("backup.autoDaily")}</p>
          <p className="text-xs text-muted-foreground">
            Create a snapshot every day when the app opens.
          </p>
        </div>
        <Switch
          checked={autoBackup}
          onCheckedChange={(v) => toggleAutoMut.mutate(v)}
          disabled={toggleAutoMut.isPending}
        />
      </Card>

      {/* Backup History */}
      <div className="mb-3">
        <SectionHeader
          title={t("backup.history")}
          subtitle={backups.length > 0 ? `${backups.length} snapshot${backups.length === 1 ? "" : "s"}` : undefined}
          action={
            backups.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => go("DEVICE")}
                className="tap-scale"
              >
                Storage
              </Button>
            ) : undefined
          }
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : backups.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" />
            </svg>
          }
          title="Your data has not been backed up yet."
          description="Create your first backup now to protect your sales, products, and reports."
          action={
            <Button
              onClick={() => snapshotMut.mutate()}
              disabled={snapshotMut.isPending}
              className="bg-primary text-primary-foreground"
            >
              Create First Backup
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {backups.map((b, i) => (
            <Card key={b.id} className="flex items-center gap-3 p-3 card-raised">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {relativeDay(b.createdAt)}
                  </p>
                  {i === 0 && <Pill tone="good">Latest</Pill>}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {formatDateTime(b.createdAt)}
                  {b.note ? ` · ${b.note}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tnum">{formatBytes(b.size)}</p>
                <p className="text-[10px] text-muted-foreground">size</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Restore confirmation dialog */}
      <RestoreConfirmDialog
        file={pendingFile}
        loading={restoreMut.isPending}
        onCancel={() => setPendingFile(null)}
        onConfirm={() => pendingFile && restoreMut.mutate(pendingFile)}
      />
    </PageScaffold>
  );
}

// ─── Action card ────────────────────────────────────────────────────────
function ActionCard({
  icon,
  title,
  description,
  onClick,
  disabled,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone: "primary" | "good" | "warn";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary ring-1 ring-primary/20",
    good: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  }[tone];
  return (
    <Card className="card-raised">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="tap-scale flex w-full items-center gap-3 p-3 text-left disabled:opacity-60"
      >
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", toneCls)}>
          {loading ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{description}</p>
        </div>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </Card>
  );
}

// ─── Restore confirmation dialog ────────────────────────────────────────
function RestoreConfirmDialog({
  file,
  loading,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restore from backup?</DialogTitle>
          <DialogDescription>
            This will overwrite your current database with the contents of the selected file. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {file && (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
              </svg>
              <p className="truncate text-sm font-medium">{file.name}</p>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground tnum">
              {formatBytes(file.size)} · {file.type || "binary"}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {loading ? "Restoring…" : "Restore backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
