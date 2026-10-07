import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const sessions = await db.cashSession.findMany({ orderBy: { openedAt: "desc" }, take: 50 });
  const open = sessions.find((s) => s.status === "OPEN") ?? null;
  // compute expected cash for the open session from its openedAt
  let expected = open?.opening ?? 0;
  if (open) {
    const sales = await db.sale.aggregate({ where: { status: "COMPLETED", paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { total: true } });
    const expenses = await db.expense.aggregate({ where: { paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    const purchases = await db.purchase.aggregate({ where: { paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { total: true } });
    const movesIn = await db.moneyMove.aggregate({ where: { account: "CASH", direction: "IN", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    const movesOut = await db.moneyMove.aggregate({ where: { account: "CASH", direction: "OUT", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    expected = (open.opening) + Number(sales._sum.total ?? 0) - Number(expenses._sum.amount ?? 0) - Number(purchases._sum.total ?? 0) + Number(movesIn._sum.amount ?? 0) - Math.abs(Number(movesOut._sum.amount ?? 0));
  }
  return NextResponse.json({ sessions, open: open ? { ...open, expected } : null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, opening, counted, note, userName } = body;
  if (action === "OPEN") {
    const existing = await db.cashSession.findFirst({ where: { status: "OPEN" } });
    if (existing) return NextResponse.json({ error: "A session is already open" }, { status: 400 });
    const session = await db.cashSession.create({ data: { opening: Number(opening) || 0, status: "OPEN", openedBy: userName || "Abebe Owner" } });
    await audit("CASH_OPEN", `Opened drawer with Br ${Number(opening).toFixed(2)}`, { name: userName });
    return NextResponse.json({ session });
  }
  if (action === "CLOSE") {
    const open = await db.cashSession.findFirst({ where: { status: "OPEN" } });
    if (!open) return NextResponse.json({ error: "No open session" }, { status: 400 });
    const sales = await db.sale.aggregate({ where: { status: "COMPLETED", paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { total: true } });
    const expenses = await db.expense.aggregate({ where: { paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    const purchases = await db.purchase.aggregate({ where: { paymentMethod: "CASH", createdAt: { gte: open.openedAt } }, _sum: { total: true } });
    const movesIn = await db.moneyMove.aggregate({ where: { account: "CASH", direction: "IN", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    const movesOut = await db.moneyMove.aggregate({ where: { account: "CASH", direction: "OUT", createdAt: { gte: open.openedAt } }, _sum: { amount: true } });
    const expected = (open.opening) + Number(sales._sum.total ?? 0) - Number(expenses._sum.amount ?? 0) - Number(purchases._sum.total ?? 0) + Number(movesIn._sum.amount ?? 0) - Math.abs(Number(movesOut._sum.amount ?? 0));
    const countedN = Number(counted) || 0;
    const session = await db.cashSession.update({
      where: { id: open.id },
      data: { status: "CLOSED", expected, counted: countedN, difference: countedN - expected, closedAt: new Date(), closedBy: userName || "Abebe Owner", note: note || null },
    });
    await audit("CASH_CLOSE", `Closed drawer · expected Br ${expected.toFixed(2)} counted Br ${countedN.toFixed(2)}`, { name: userName });
    return NextResponse.json({ session });
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
