import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // OPEN | SETTLED | null
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const debts = await db.debt.findMany({
    where: where as never,
    include: { customer: true, payments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const enriched = debts.map((d) => ({
    ...d,
    balance: Math.round((d.amount - d.paid) * 100) / 100,
  }));

  const totalOutstanding = enriched
    .filter((d) => d.status === "OPEN")
    .reduce((s, d) => s + d.balance, 0);

  return NextResponse.json({ debts: enriched, totalOutstanding: Math.round(totalOutstanding * 100) / 100 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { customerId, amount, note, dueDate, userName } = body;
  if (!customerId || !amount) return NextResponse.json({ error: "customerId and amount required" }, { status: 400 });
  const debt = await db.debt.create({
    data: {
      customerId,
      amount: Number(amount),
      paid: 0,
      status: "OPEN",
      note: note || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      userName: userName || "Abebe Owner",
    },
    include: { customer: true },
  });
  await audit("DEBT_CREATE", `Debt for ${debt.customer.name} · Br ${Number(amount).toFixed(2)}`, { name: userName }, { debtId: debt.id });
  return NextResponse.json({ debt });
}
