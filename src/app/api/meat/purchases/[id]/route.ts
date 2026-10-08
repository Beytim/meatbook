import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const purchase = await db.purchase.delete({ where: { id }, include: { items: true } });
    // Also delete the supplier ledger entry if this was a credit purchase
    if (purchase.paymentMethod === "CREDIT") {
      await db.ledgerEntry.deleteMany({ where: { purchaseId: id } });
    }
    await audit("PURCHASE_DELETE", `Deleted purchase from ${purchase.supplier || "supplier"} · Br ${purchase.total.toFixed(2)}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete purchase" }, { status: 400 });
  }
}
