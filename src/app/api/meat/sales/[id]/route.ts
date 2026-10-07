import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await db.sale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ sale: { ...sale, number: String(sale.number).padStart(6, "0") } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as "VOID" | "REFUND";
  if (action !== "VOID" && action !== "REFUND") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  const sale = await db.sale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (sale.status !== "COMPLETED") {
    return NextResponse.json({ error: "sale not voidable" }, { status: 400 });
  }
  const newStatus = action === "VOID" ? "VOIDED" : "REFUNDED";
  const updated = await db.sale.update({ where: { id }, data: { status: newStatus, note: body.note || sale.note } });
  await audit(action === "VOID" ? "SALE_VOID" : "SALE_REFUND", `#${String(sale.number).padStart(6, "0")} ${newStatus.toLowerCase()}`, undefined, { saleId: id });
  return NextResponse.json({ sale: { ...updated, number: String(updated.number).padStart(6, "0") } });
}
