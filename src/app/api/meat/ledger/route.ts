import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  const where: Record<string, unknown> = {};
  if (supplierId) where.supplierId = supplierId;

  const entries = await db.ledgerEntry.findMany({
    where: where as never,
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const totalDebit = entries.filter((e) => e.kind === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const totalCredit = entries.filter((e) => e.kind === "CREDIT").reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      // DEBIT increases what we owe, CREDIT decreases it
      signedAmount: e.kind === "DEBIT" ? e.amount : -e.amount,
    })),
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    balance: Math.round((totalDebit - totalCredit) * 100) / 100,
  });
}

// Record a ledger entry (DEBIT = credit purchase, CREDIT = payment)
export async function POST(req: Request) {
  const body = await req.json();
  const { supplierId, kind, amount, paymentMethod, paymentDetail, note, userName } = body;
  if (!supplierId || !kind || !amount) return NextResponse.json({ error: "supplierId, kind, amount required" }, { status: 400 });
  if (kind !== "DEBIT" && kind !== "CREDIT") return NextResponse.json({ error: "kind must be DEBIT or CREDIT" }, { status: 400 });

  const entry = await db.ledgerEntry.create({
    data: {
      supplierId,
      kind,
      amount: Number(amount),
      paymentMethod: kind === "CREDIT" ? (paymentMethod || "CASH").toUpperCase() : null,
      paymentDetail: kind === "CREDIT" && paymentMethod !== "CASH" ? (paymentDetail || null) : null,
      note: note || null,
      userName: userName || "Abebe Owner",
    },
    include: { supplier: true },
  });
  await audit(
    kind === "DEBIT" ? "LEDGER_DEBIT" : "LEDGER_CREDIT",
    `${kind === "DEBIT" ? "Credit purchase" : "Payment"} — ${entry.supplier.name} · Br ${Number(amount).toFixed(2)}`,
    { name: userName },
    { entryId: entry.id }
  );
  return NextResponse.json({ entry });
}
