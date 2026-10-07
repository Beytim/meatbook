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

  let purchases = await db.purchase.findMany({
    where: where as never,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  if (q) {
    const ql = q.toLowerCase();
    purchases = purchases.filter((p) =>
      p.supplier?.toLowerCase().includes(ql) ||
      p.note?.toLowerCase().includes(ql) ||
      p.userName?.toLowerCase().includes(ql) ||
      p.items.some((i) => i.name.toLowerCase().includes(ql) || (i.animalType ?? "").toLowerCase().includes(ql))
    );
  }

  const total = purchases.reduce((s, p) => s + p.total, 0);
  const totalKg = purchases.reduce((s, p) => s + p.items.reduce((k, i) => k + i.kg, 0), 0);

  // Animal-type breakdown for this period (Ox kg+amount, Sheep kg+amount, Goat kg+amount)
  const animalBreakdown: Record<string, { kg: number; amount: number; count: number }> = {};
  for (const p of purchases) {
    for (const i of p.items) {
      const key = i.animalType || "OTHER";
      if (!animalBreakdown[key]) animalBreakdown[key] = { kg: 0, amount: 0, count: 0 };
      animalBreakdown[key].kg += i.kg;
      animalBreakdown[key].amount += i.total;
      animalBreakdown[key].count += 1;
    }
  }

  return NextResponse.json({
    purchases,
    stats: { total, count: purchases.length, totalKg },
    animalBreakdown,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { supplier, note, paymentMethod, paymentDetail, items, userName } = body as {
    supplier?: string; note?: string; paymentMethod?: string; paymentDetail?: string;
    items: { productId?: string; animalType?: string; name?: string; kg: number; amount: number }[];
    userName?: string;
  };
  if (!items || items.length === 0) return NextResponse.json({ error: "items required" }, { status: 400 });

  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const method = (paymentMethod || "CASH").toUpperCase();
  const purchase = await db.purchase.create({
    data: {
      supplier: supplier || null,
      note: note || null,
      paymentMethod: method,
      paymentDetail: method === "CASH" ? null : (paymentDetail || null),
      total: Math.round(total * 100) / 100,
      userName: userName || "Abebe Owner",
      items: {
        create: items.map((i) => {
          const kg = Number(i.kg) || 0;
          const amount = Number(i.amount) || 0;
          return {
            productId: i.productId || null,
            animalType: i.animalType || null,
            name: i.name || i.animalType || "Item",
            kg,
            unitCost: kg > 0 ? Math.round((amount / kg) * 100) / 100 : 0, // derived, display only
            total: amount, // manually-entered amount
          };
        }),
      },
    },
    include: { items: true },
  });
  await audit("PURCHASE_CREATE", `Purchase from ${supplier || "supplier"} · Br ${total.toFixed(2)}`, { name: userName }, { purchaseId: purchase.id });
  return NextResponse.json({ purchase });
}
