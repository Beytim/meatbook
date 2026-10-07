import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const { from, to } = periodRange(period);
  const createdAtRange = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };

  // all-time account balances from money moves + completed sales
  const [cashMoves, mobileMoves, bankMoves, salesByMethod, expensesByMethod, purchasesByMethod] = await Promise.all([
    db.moneyMove.aggregate({ where: { account: "CASH" }, _sum: { amount: true } }),
    db.moneyMove.aggregate({ where: { account: "MOBILE" }, _sum: { amount: true } }),
    db.moneyMove.aggregate({ where: { account: "BANK" }, _sum: { amount: true } }),
    db.sale.groupBy({ by: ["paymentMethod"], where: { status: "COMPLETED" }, _sum: { total: true } }),
    db.expense.groupBy({ by: ["paymentMethod"], where: {}, _sum: { amount: true } }),
    db.purchase.groupBy({ by: ["paymentMethod"], where: {}, _sum: { total: true } }),
  ]);

  const methodSale = (m: string) => salesByMethod.find((g) => g.paymentMethod === m)?._sum.total ?? 0;
  const methodExpense = (m: string) => expensesByMethod.find((g) => g.paymentMethod === m)?._sum.amount ?? 0;
  const methodPurchase = (m: string) => purchasesByMethod.find((g) => g.paymentMethod === m)?._sum.total ?? 0;

  const cashBalance = Number(cashMoves._sum.amount ?? 0) + methodSale("CASH") - methodExpense("CASH") - methodPurchase("CASH");
  const mobileBalance = Number(mobileMoves._sum.amount ?? 0) + methodSale("MOBILE") - methodExpense("MOBILE") - methodPurchase("MOBILE");
  const bankBalance = Number(bankMoves._sum.amount ?? 0) + methodSale("BANK") - methodExpense("BANK") - methodPurchase("BANK");

  // period flow
  const [periodSalesIn, periodExpensesOut, periodPurchasesOut, periodMoves] = await Promise.all([
    db.sale.aggregate({ where: { status: "COMPLETED", ...createdAtRange }, _sum: { total: true } }),
    db.expense.aggregate({ where: createdAtRange, _sum: { amount: true } }),
    db.purchase.aggregate({ where: createdAtRange, _sum: { total: true } }),
    db.moneyMove.findMany({ where: createdAtRange, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const moneyIn = Number(periodSalesIn._sum.total ?? 0) + periodMoves.filter((m) => m.direction === "IN").reduce((s, m) => s + m.amount, 0);
  const moneyOut = Number(periodExpensesOut._sum.amount ?? 0) + Number(periodPurchasesOut._sum.total ?? 0) + periodMoves.filter((m) => m.direction === "OUT").reduce((s, m) => s + m.amount, 0);
  const net = moneyIn - moneyOut;

  return NextResponse.json({
    accounts: { cash: cashBalance, mobile: mobileBalance, bank: bankBalance },
    flow: { in: moneyIn, out: moneyOut, net },
    transactions: periodMoves.map((m) => ({
      id: m.id,
      kind: m.direction,
      account: m.account,
      amount: m.amount,
      reason: m.reason,
      note: m.note,
      userName: m.userName,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { direction, account, amount, reason, note, userName } = body as {
    direction: "IN" | "OUT";
    account: "CASH" | "MOBILE" | "BANK";
    amount: number;
    reason?: string;
    note?: string;
    userName?: string;
  };
  if (!direction || !account || !amount) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const move = await db.moneyMove.create({
    data: {
      direction,
      account,
      amount: direction === "OUT" ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
      reason: reason || null,
      note: note || null,
      userName: userName || "Abebe Owner",
    },
  });
  return NextResponse.json({ move });
}
