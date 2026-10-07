"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNav } from "@/lib/nav";
import {
  cn, formatDate, initials, colorFromString,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  PageScaffold, StatTile, EmptyState, Pill, ListSkeleton, SectionHeader,
} from "@/components/app/primitives";

// ─── Types ──────────────────────────────────────────────────────────────
type Role = "OWNER" | "MANAGER" | "CASHIER";

interface StaffMember {
  id: string;
  name: string;
  role: Role;
  pin: string | null;
  active: boolean;
  joinedAt: string;
}

interface StaffResp { staff: StaffMember[] }

// ─── Helpers ────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
};
const ROLE_TONE: Record<Role, "primary" | "warn" | "muted"> = {
  OWNER: "primary",
  MANAGER: "warn",
  CASHIER: "muted",
};

// Current signed-in user is "Abebe Owner" (per spec).
const CURRENT_USER = "Abebe Owner";

// Role permission matrix — static informative content.
const PERMISSIONS: { label: string; owner: boolean; manager: boolean; cashier: boolean }[] = [
  { label: "Sell & complete sales", owner: true, manager: true, cashier: true },
  { label: "Reprint / share receipts", owner: true, manager: true, cashier: true },
  { label: "Refund or void a sale", owner: true, manager: true, cashier: false },
  { label: "View reports", owner: true, manager: true, cashier: false },
  { label: "View staff", owner: true, manager: true, cashier: false },
  { label: "Open / close cash drawer", owner: true, manager: true, cashier: false },
  { label: "Manage staff (add / edit / delete)", owner: true, manager: false, cashier: false },
  { label: "Manage products & prices", owner: true, manager: false, cashier: false },
  { label: "Manage purchases, wastage, expenses", owner: true, manager: false, cashier: false },
  { label: "Settings, license, backups", owner: true, manager: false, cashier: false },
];

// ─── View ───────────────────────────────────────────────────────────────
export function StaffView() {
  const { back } = useNav();
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<StaffMember | null>(null);
  const [adding, setAdding] = React.useState(false);

  const { data, isLoading } = useQuery<StaffResp>({
    queryKey: ["staff"],
    queryFn: async () => {
      const r = await fetch("/api/meat/staff");
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const staff = data?.staff ?? [];
  const totalStaff = staff.length;
  const activeCount = staff.filter((s) => s.active).length;
  const ownerCount = staff.filter((s) => s.role === "OWNER").length;

  const invalidateAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ["staff"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["money"] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  }, [qc]);

  return (
    <PageScaffold
      title="Staff"
      subtitle="Roles, PINs & access"
      onBack={() => back()}
      right={
        <Button
          onClick={() => setAdding(true)}
          size="sm"
          className="bg-primary text-primary-foreground meat-glow"
        >
          <svg viewBox="0 0 24 24" className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
          </svg>
          Add Staff
        </Button>
      }
    >
      {/* Top stat tiles */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <StatTile label="Total Staff" value={<span className="tnum">{totalStaff}</span>} tone="default" />
        <StatTile label="Active" value={<span className="tnum">{activeCount}</span>} sub="working now" tone="good" />
        <StatTile label="Owners" value={<span className="tnum">{ownerCount}</span>} tone="primary" />
      </div>

      {/* Staff list */}
      <div className="mb-3">
        <SectionHeader title={`All Staff (${totalStaff})`} subtitle="Tap a member to edit their role, PIN, or status" />
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 11h6M19 8v6" />
            </svg>
          }
          title="No staff yet."
          description="Add your first team member to start tracking who does what."
          action={<Button onClick={() => setAdding(true)} className="bg-primary text-primary-foreground">Add Staff</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {staff.map((m) => (
            <StaffCard key={m.id} member={m} onEdit={() => setEditing(m)} />
          ))}
        </div>
      )}

      {/* Role permissions matrix */}
      <div className="mt-6">
        <SectionHeader title="Role Permissions" subtitle="What each role can do in MeatBook" />
      </div>
      <Card className="mt-2 overflow-hidden card-raised">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 border-b border-border/60 bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Capability</span>
          <span className="w-14 text-center">Owner</span>
          <span className="w-14 text-center">Manager</span>
          <span className="w-14 text-center">Cashier</span>
        </div>
        {PERMISSIONS.map((p, i) => (
          <div
            key={p.label}
            className={cn(
              "grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 px-3 py-2.5 text-xs",
              i !== PERMISSIONS.length - 1 && "border-b border-border/40",
            )}
          >
            <span className="text-foreground">{p.label}</span>
            <PermCell ok={p.owner} tone="primary" />
            <PermCell ok={p.manager} tone="warn" />
            <PermCell ok={p.cashier} tone="muted" />
          </div>
        ))}
      </Card>

      {/* Add / Edit dialogs */}
      <StaffDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSuccess={invalidateAll}
      />
      <StaffDialog
        open={!!editing}
        member={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSuccess={invalidateAll}
      />
    </PageScaffold>
  );
}

// ─── Staff card ─────────────────────────────────────────────────────────
function StaffCard({ member, onEdit }: { member: StaffMember; onEdit: () => void }) {
  const initialsStr = initials(member.name) || "?";
  const isYou = member.name.trim().toLowerCase() === CURRENT_USER.toLowerCase();
  const role = member.role as Role;
  const colorCls = colorFromString(member.name);
  return (
    <Card className="flex items-center gap-3 p-3 card-raised">
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold",
          colorCls,
        )}
      >
        {initialsStr}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill>
          {isYou && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">You</span>
          )}
          {!member.active && <Pill tone="muted">Inactive</Pill>}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          Joined {formatDate(member.joinedAt)}
          {member.pin ? " · PIN set" : " · no PIN"}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0 tap-scale">
        Edit
      </Button>
    </Card>
  );
}

function PermCell({ ok, tone }: { ok: boolean; tone: "primary" | "warn" | "muted" }) {
  if (!ok) {
    return <span className="w-14 text-center text-muted-foreground/40">—</span>;
  }
  const cls = {
    primary: "bg-primary/15 text-primary",
    warn: "bg-amber-500/15 text-amber-400",
    muted: "bg-muted/60 text-muted-foreground",
  }[tone];
  return (
    <span className={cn("mx-auto grid h-5 w-5 place-items-center rounded-full", cls)}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

// ─── Add / Edit dialog ──────────────────────────────────────────────────
function StaffDialog({
  open,
  member,
  onClose,
  onSuccess,
}: {
  open: boolean;
  member?: StaffMember;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!member;
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<Role>("CASHIER");
  const [pin, setPin] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Sync form whenever dialog opens (add or edit).
  React.useEffect(() => {
    if (!open) return;
    if (member) {
      setName(member.name);
      setRole((member.role as Role) || "CASHIER");
      setPin(member.pin ?? "");
      setActive(member.active);
    } else {
      setName("");
      setRole("CASHIER");
      setPin("");
      setActive(true);
    }
    setConfirmDelete(false);
  }, [open, member]);

  const qc = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: async () => {
      const pinVal = pin.trim() ? pin.trim() : null;
      if (isEdit && member) {
        const r = await fetch("/api/meat/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: member.id, name, role, pin: pinVal, active }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || "Failed");
        }
        return r.json();
      }
      if (!name.trim()) throw new Error("Name is required");
      const r = await fetch("/api/meat/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, pin: pinVal }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "Staff updated" : `${name.trim()} added as ${ROLE_LABEL[role]}`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("no member");
      const r = await fetch(`/api/meat/staff?id=${encodeURIComponent(member.id)}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(`${member?.name ?? "Staff"} removed`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed"),
  });

  const pinValid = pin === "" || /^\d{4}$/.test(pin.trim());
  const canSave = name.trim().length > 0 && pinValid && !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Staff" : "Add Staff"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update role, PIN, or active status."
              : "Create a new team member with a role and optional PIN."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-name" className="text-xs text-muted-foreground">Name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-pin" className="text-xs text-muted-foreground">
              PIN <span className="opacity-70">(4 digits, optional)</span>
            </Label>
            <Input
              id="staff-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="e.g. 1234"
              className="tnum"
            />
            {!pinValid && (
              <p className="text-[11px] text-red-400">PIN must be exactly 4 digits.</p>
            )}
          </div>

          {isEdit && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-[11px] text-muted-foreground">Inactive members can't sign in.</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </>
          )}
        </div>

        <DialogFooter className={isEdit ? "sm:justify-between" : undefined}>
          {isEdit ? (
            <div className="order-2 flex w-full gap-2 sm:order-1 sm:w-auto">
              {confirmDelete ? (
                <>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleteMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Confirm delete"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-500"
                >
                  <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                  Delete
                </Button>
              )}
            </div>
          ) : null}
          <div className="order-1 flex gap-2 sm:order-2 sm:ml-auto">
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSave} className="bg-primary text-primary-foreground">
              {saveMutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add staff"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
