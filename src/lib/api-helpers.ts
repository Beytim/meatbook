import { db } from "@/lib/db";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

// build a where clause for createdAt within a period
export function periodWhere(period: PeriodKey): Prisma.SaleWhereInput {
  if (period === "ALL") return {};
  const { from, to } = periodRange(period);
  return { createdAt: { gte: from, lte: to } };
}

export function dateWhere(from: Date, to: Date) {
  return { createdAt: { gte: from, lte: to } };
}

// Get or create the singleton settings row
export async function getSettings() {
  const s = await db.setting.findUnique({ where: { id: "singleton" } });
  if (s) return s;
  return db.setting.create({ data: { id: "singleton" } });
}

// increment the sale number counter atomically
export async function nextSaleNumber(): Promise<number> {
  const counter = await db.counter.upsert({
    where: { id: "singleton" },
    update: { saleNumber: { increment: 1 } },
    create: { id: "singleton", saleNumber: 2 },
  });
  return counter.saleNumber - 1;
}

export async function audit(action: string, description?: string, user?: { id?: string; name?: string }, meta?: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: {
        action,
        description,
        userId: user?.id,
        userName: user?.name,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    // ignore audit failures
  }
}

// payment method label
export function paymentLabel(method: string, detail?: string | null): string {
  const m = method.toUpperCase();
  if (m === "CASH") return "Cash";
  if (m === "MOBILE") return `Mobile${detail ? ` · ${detail}` : ""}`;
  if (m === "BANK") return `Bank${detail ? ` · ${detail}` : ""}`;
  return method;
}
