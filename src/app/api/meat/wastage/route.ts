import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const q = searchParams.get("q") || "";
  const { from, to } = periodRange(period);
  const where = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };

  let entries = await db.wastage.findMany({ where: where as never, orderBy: { createdAt: "desc" } });
  if (q) {
    const ql = q.toLowerCase();
    entries = entries.filter((e) => e.name.toLowerCase().includes(ql) || e.reason?.toLowerCase().includes(ql) || e.note?.toLowerCase().includes(ql));
  }
  const totalKg = entries.reduce((s, e) => s + e.kg, 0);
  return NextResponse.json({ entries, stats: { totalKg, count: entries.length } });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { productId, name, kg, reason, note, userName } = body;
  if (!name || !kg) return NextResponse.json({ error: "name and kg required" }, { status: 400 });
  const entry = await db.wastage.create({
    data: { productId: productId || null, name: String(name), kg: Number(kg), reason: reason || null, note: note || null, userName: userName || "Abebe Owner" },
  });
  await audit("WASTAGE_CREATE", `Wasted ${kg} kg ${name}`, { name: userName }, { wastageId: entry.id });
  return NextResponse.json({ entry });
}
