import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const products = await db.product.findMany({ orderBy: { name: "asc" } });

  // Today's sales per product (for inline stats on product cards)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayRange = { createdAt: { gte: todayStart, lte: now } };

  const todayStats = await db.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { status: "COMPLETED", ...todayRange } },
    _sum: { total: true, kg: true },
    _count: true,
  });

  // All-time sales per product
  const allTimeStats = await db.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { status: "COMPLETED" } },
    _sum: { total: true, kg: true },
    _count: true,
  });

  // Merge stats into products
  const enriched = products.map((p) => {
    const today = todayStats.find((s) => s.productId === p.id);
    const allTime = allTimeStats.find((s) => s.productId === p.id);
    return {
      ...p,
      todaySales: today ? Number(today._sum.total ?? 0) : 0,
      todayKg: today ? Number(today._sum.kg ?? 0) : 0,
      todayCount: today ? today._count : 0,
      allTimeSales: allTime ? Number(allTime._sum.total ?? 0) : 0,
      allTimeKg: allTime ? Number(allTime._sum.kg ?? 0) : 0,
      allTimeCount: allTime ? allTime._count : 0,
    };
  });

  return NextResponse.json({ products: enriched });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, emoji, priceTakeHome, priceEatHere } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const product = await db.product.create({
      data: {
        name: String(name),
        emoji: emoji ? String(emoji) : "🥩",
        priceTakeHome: Number(priceTakeHome) || 0,
        priceEatHere: Number(priceEatHere) || 0,
      },
    });
    await audit("PRODUCT_CREATE", `Created product ${product.name}`, undefined, { productId: product.id });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: "Could not create product" }, { status: 400 });
  }
}
