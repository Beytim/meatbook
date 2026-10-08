import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const expense = await db.expense.delete({ where: { id } });
    await audit("EXPENSE_DELETE", `Deleted expense ${expense.category} · Br ${expense.amount.toFixed(2)}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete expense" }, { status: 400 });
  }
}
