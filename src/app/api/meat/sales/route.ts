import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nextSaleNumber, audit } from "@/lib/api-helpers";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const status = searchParams.get("status"); // COMPLETED | VOIDED | REFUNDED | null
  const q = searchParams.get("q") || "";

  const { from, to } = periodRange(period);
  const where: Record<string, unknown> = {
    createdAt: period === "ALL" ? undefined : { gte: from, lte: to },
  };
  if (where.createdAt === undefined) delete where.createdAt;
  if (status) where.status = status;

  let sales = await db.sale.findMany({
    where: where as never,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  if (q) {
    const ql = q.toLowerCase();
    sales = sales.filter(
      (s) =>
        String(s.number).padStart(6, "0").includes(ql) ||
        s.cashierName?.toLowerCase().includes(ql) ||
        s.items.some((i) => i.name.toLowerCase().includes(ql))
    );
  }

  const revenue = sales
    .filter((s) => s.status === "COMPLETED")
    .reduce((sum, s) => sum + s.total, 0);
  const kgSold = sales
    .filter((s) => s.status === "COMPLETED")
    .reduce((sum, s) => sum + s.totalKg, 0);
  const count = sales.filter((s) => s.status === "COMPLETED").length;

  return NextResponse.json({
    sales: sales.map((s) => ({
      ...s,
      number: String(s.number).padStart(6, "0"),
    })),
    stats: { revenue, kgSold, count },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { type, paymentMethod, paymentDetail, items, cashierName, note, creditCustomerId, creditCustomerName } = body as {
    type: "TAKE_HOME" | "EAT_HERE";
    paymentMethod: "CASH" | "MOBILE" | "BANK" | "CREDIT";
    paymentDetail?: string;
    items: { productId: string; name: string; unitPrice: number; kg: number; total: number }[];
    cashierName?: string;
    note?: string;
    creditCustomerId?: string;
    creditCustomerName?: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Sale must have at least one item" }, { status: 400 });
  }

  const total = items.reduce((s, i) => s + Number(i.total), 0);
  const totalKg = items.reduce((s, i) => s + Number(i.kg), 0);
  const number = await nextSaleNumber();

  const method = String(paymentMethod || "CASH").toUpperCase();
  const sale = await db.sale.create({
    data: {
      number,
      type: type === "EAT_HERE" ? "EAT_HERE" : "TAKE_HOME",
      paymentMethod: method,
      paymentDetail: method === "CASH" || method === "CREDIT" ? null : (paymentDetail || null),
      total: Math.round(total * 100) / 100,
      totalKg: Math.round(totalKg * 100) / 100,
      status: "COMPLETED",
      cashierName: cashierName || "Abebe Owner",
      note: note || null,
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          unitPrice: Number(i.unitPrice),
          kg: Number(i.kg),
          total: Number(i.total),
        })),
      },
    },
    include: { items: true },
  });

  // ─── INTEGRATION: Credit sale → create a debt ──────────────────────
  if (method === "CREDIT" && creditCustomerId) {
    await db.debt.create({
      data: {
        customerId: creditCustomerId,
        saleId: sale.id,
        saleNumber: sale.number,
        amount: Math.round(total * 100) / 100,
        paid: 0,
        status: "OPEN",
        note: `Credit sale #${String(sale.number).padStart(6, "0")}${creditCustomerName ? ` — ${creditCustomerName}` : ""}`,
        userName: cashierName || "Abebe Owner",
      },
    });
    await audit("DEBT_CREATE", `Credit sale #${String(number).padStart(6, "0")} → debt for ${creditCustomerName || "customer"} · Br ${total.toFixed(2)}`, { name: cashierName }, { saleId: sale.id });
  }

  await audit("SALE_CREATE", `Sale #${String(number).padStart(6, "0")} · Br ${total.toFixed(2)}${method === "CREDIT" ? " (credit)" : ""}`, { name: cashierName }, { saleId: sale.id, total });

  return NextResponse.json({
    sale: { ...sale, number: String(sale.number).padStart(6, "0") },
  });
}
