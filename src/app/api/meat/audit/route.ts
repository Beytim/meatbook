import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const q = searchParams.get("q") || "";
  const { from, to } = periodRange(period);
  const where = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };

  let events = await db.auditLog.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 200 });
  if (q) {
    const ql = q.toLowerCase();
    events = events.filter((e) => e.action.toLowerCase().includes(ql) || e.description?.toLowerCase().includes(ql) || e.userName?.toLowerCase().includes(ql));
  }
  return NextResponse.json({ events, count: events.length });
}
