import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

// Record a payment against a debt
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { amount, paymentMethod, paymentDetail, note, userName } = body;
  if (!amount || amount <= 0) return NextResponse.json({ error: "amount required" }, { status: 400 });

  const debt = await db.debt.findUnique({ where: { id }, include: { customer: true } });
  if (!debt) return NextResponse.json({ error: "debt not found" }, { status: 404 });

  const newPaid = Math.round((debt.paid + Number(amount)) * 100) / 100;
  const balance = Math.max(0, debt.amount - newPaid);
  const isSettled = balance <= 0;

  const [payment, updatedDebt] = await Promise.all([
    db.debtPayment.create({
      data: {
        debtId: id,
        amount: Number(amount),
        paymentMethod: (paymentMethod || "CASH").toUpperCase(),
        paymentDetail: paymentMethod === "CASH" ? null : (paymentDetail || null),
        note: note || null,
        userName: userName || "Abebe Owner",
      },
    }),
    db.debt.update({
      where: { id },
      data: { paid: newPaid, status: isSettled ? "SETTLED" : "OPEN" },
    }),
  ]);

  await audit("DEBT_PAYMENT", `Payment Br ${Number(amount).toFixed(2)} from ${debt.customer.name}`, { name: userName }, { debtId: id });

  return NextResponse.json({ payment, debt: updatedDebt, balance });
}
