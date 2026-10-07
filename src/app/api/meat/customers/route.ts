import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    include: { debts: { include: { payments: true } } },
  });
  // compute balance per customer
  const enriched = customers.map((c) => {
    const openDebts = c.debts.filter((d) => d.status === "OPEN");
    const totalOwed = openDebts.reduce((s, d) => s + (d.amount - d.paid), 0);
    return {
      id: c.id, name: c.name, phone: c.phone, note: c.note, active: c.active,
      createdAt: c.createdAt,
      openDebtCount: openDebts.length,
      totalOwed: Math.round(totalOwed * 100) / 100,
    };
  });
  return NextResponse.json({ customers: enriched });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, phone, note } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const customer = await db.customer.create({ data: { name: String(name), phone: phone || null, note: note || null } });
  await audit("CUSTOMER_CREATE", `Added customer ${name}`, undefined, { customerId: customer.id });
  return NextResponse.json({ customer });
}
