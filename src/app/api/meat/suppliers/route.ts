import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { ledger: true },
  });
  const enriched = suppliers.map((s) => {
    const debit = s.ledger.filter((e) => e.kind === "DEBIT").reduce((sum, e) => sum + e.amount, 0);
    const credit = s.ledger.filter((e) => e.kind === "CREDIT").reduce((sum, e) => sum + e.amount, 0);
    const balance = Math.round((debit - credit) * 100) / 100;
    return {
      id: s.id, name: s.name, phone: s.phone, note: s.note, active: s.active,
      createdAt: s.createdAt,
      totalDebit: Math.round(debit * 100) / 100,
      totalCredit: Math.round(credit * 100) / 100,
      balance, // positive = we owe them
    };
  });
  return NextResponse.json({ suppliers: enriched });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, phone, note } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const supplier = await db.supplier.create({ data: { name: String(name), phone: phone || null, note: note || null } });
  await audit("SUPPLIER_CREATE", `Added supplier ${name}`, undefined, { supplierId: supplier.id });
  return NextResponse.json({ supplier });
}
