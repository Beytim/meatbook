import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/accounts";

interface SubBalance { detail: string | null; amount: number; }

function buildTree(
  method: PaymentMethod,
  moves: { detail: string | null; amount: number; direction: string }[],
  salesByMD: { paymentMethod: string; paymentDetail: string | null; _sum: { total: number | null } }[],
  expensesByMD: { paymentMethod: string; paymentDetail: string | null; _sum: { amount: number | null } }[],
  purchasesByMD: { paymentMethod: string; paymentDetail: string | null; _sum: { total: number | null } }[],
) {
  const byDetail = new Map<string, number>();
  for (const m of moves) {
    const key = m.detail ?? "";
    const cur = byDetail.get(key) ?? 0;
    byDetail.set(key, cur + (m.direction === "IN" ? m.amount : -Math.abs(m.amount)));
  }
  salesByMD.filter((r) => r.paymentMethod === method).forEach((r) => {
    const key = r.paymentDetail ?? "";
    byDetail.set(key, (byDetail.get(key) ?? 0) + Number(r._sum.total ?? 0));
  });
  expensesByMD.filter((r) => r.paymentMethod === method).forEach((r) => {
    const key = r.paymentDetail ?? "";
    byDetail.set(key, (byDetail.get(key) ?? 0) - Number(r._sum.amount ?? 0));
  });
  purchasesByMD.filter((r) => r.paymentMethod === method).forEach((r) => {
    const key = r.paymentDetail ?? "";
    byDetail.set(key, (byDetail.get(key) ?? 0) - Number(r._sum.total ?? 0));
  });
  const subs: SubBalance[] = Array.from(byDetail.entries())
    .map(([k, v]) => ({ detail: k || null, amount: Math.round(v * 100) / 100 }))
    .filter((s) => Math.abs(s.amount) > 0.005)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const total = subs.reduce((s, x) => s + x.amount, 0);
  return { total: Math.round(total * 100) / 100, subAccounts: subs };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const { from, to } = periodRange(period);
  const createdAtRange = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };

  // all-time balances
  const [cashMoves, mobileMoves, bankMoves, salesByMD, expensesByMD, purchasesByMD] = await Promise.all([
    db.moneyMove.findMany({ where: { account: "CASH" } }),
    db.moneyMove.findMany({ where: { account: "MOBILE" } }),
    db.moneyMove.findMany({ where: { account: "BANK" } }),
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: { status: "COMPLETED" }, _sum: { total: true } }),
    db.expense.groupBy({ by: ["paymentMethod", "paymentDetail"], _sum: { amount: true } }),
    db.purchase.groupBy({ by: ["paymentMethod", "paymentDetail"], _sum: { total: true } }),
  ]);

  const cashTree = buildTree("CASH", cashMoves, salesByMD, expensesByMD, purchasesByMD);
  const mobileTree = buildTree("MOBILE", mobileMoves, salesByMD, expensesByMD, purchasesByMD);
  const bankTree = buildTree("BANK", bankMoves, salesByMD, expensesByMD, purchasesByMD);

  // period flow
  const [periodSalesIn, periodExpensesOut, periodPurchasesOut, periodMoves, periodSales, periodExpenses, periodPurchases] = await Promise.all([
    db.sale.aggregate({ where: { status: "COMPLETED", ...createdAtRange }, _sum: { total: true } }),
    db.expense.aggregate({ where: createdAtRange, _sum: { amount: true } }),
    db.purchase.aggregate({ where: createdAtRange, _sum: { total: true } }),
    db.moneyMove.findMany({ where: createdAtRange, orderBy: { createdAt: "desc" }, take: 50 }),
    // Unified transaction feed: sales + expenses + purchases + moves
    db.sale.findMany({ where: { status: "COMPLETED", ...createdAtRange }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, number: true, total: true, paymentMethod: true, paymentDetail: true, type: true, cashierName: true, createdAt: true } }),
    db.expense.findMany({ where: createdAtRange, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, category: true, amount: true, paymentMethod: true, paymentDetail: true, userName: true, createdAt: true } }),
    db.purchase.findMany({ where: createdAtRange, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, supplier: true, total: true, paymentMethod: true, paymentDetail: true, userName: true, createdAt: true } }),
  ]);

  const moneyIn = Number(periodSalesIn._sum.total ?? 0) + periodMoves.filter((m) => m.direction === "IN").reduce((s, m) => s + m.amount, 0);
  const moneyOut = Number(periodExpensesOut._sum.amount ?? 0) + Number(periodPurchasesOut._sum.total ?? 0) + periodMoves.filter((m) => m.direction === "OUT").reduce((s, m) => s + Math.abs(m.amount), 0);
  const net = moneyIn - moneyOut;

  // Build unified transaction list: combine sales (IN), expenses (OUT), purchases (OUT), moves (IN/OUT)
  type Tx = { id: string; kind: "IN" | "OUT"; source: string; amount: number; account: string; detail: string | null; reason: string; userName: string | null; createdAt: Date };
  const allTx: Tx[] = [];

  // Sales = money IN
  periodSales.forEach((s) => {
    allTx.push({
      id: "sale-" + s.id, kind: "IN", source: "Sale #" + String(s.number).padStart(6, "0"),
      amount: s.total, account: s.paymentMethod, detail: s.paymentDetail,
      reason: `${s.type === "TAKE_HOME" ? "Take Home" : "Eat Here"} sale`, userName: s.cashierName, createdAt: s.createdAt,
    });
  });

  // Purchases = money OUT
  periodPurchases.forEach((p) => {
    allTx.push({
      id: "pur-" + p.id, kind: "OUT", source: "Purchase",
      amount: p.total, account: p.paymentMethod, detail: p.paymentDetail,
      reason: p.supplier ? `Meat from ${p.supplier}` : "Purchase", userName: p.userName, createdAt: p.createdAt,
    });
  });

  // Expenses = money OUT
  periodExpenses.forEach((e) => {
    allTx.push({
      id: "exp-" + e.id, kind: "OUT", source: "Expense",
      amount: e.amount, account: e.paymentMethod, detail: e.paymentDetail,
      reason: e.category, userName: e.userName, createdAt: e.createdAt,
    });
  });

  // Manual moves
  periodMoves.forEach((m) => {
    allTx.push({
      id: "move-" + m.id, kind: m.direction as "IN" | "OUT", source: "Manual",
      amount: Math.abs(m.amount), account: m.account, detail: m.detail,
      reason: m.reason || (m.direction === "IN" ? "Cash In" : "Cash Out"), userName: m.userName, createdAt: m.createdAt,
    });
  });

  // Sort all by date desc, take 100
  allTx.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unifiedTransactions = allTx.slice(0, 100).map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  return NextResponse.json({
    accounts: { cash: cashTree.total, mobile: mobileTree.total, bank: bankTree.total },
    tree: { CASH: cashTree, MOBILE: mobileTree, BANK: bankTree },
    flow: { in: moneyIn, out: moneyOut, net },
    transactions: unifiedTransactions,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { direction, account, detail, amount, reason, note, userName } = body as {
    direction: "IN" | "OUT"; account: "CASH" | "MOBILE" | "BANK"; detail?: string;
    amount: number; reason?: string; note?: string; userName?: string;
  };
  if (!direction || !account || !amount) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const move = await db.moneyMove.create({
    data: {
      direction, account, detail: account === "CASH" ? null : (detail || null),
      amount: direction === "OUT" ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
      reason: reason || null, note: note || null, userName: userName || "Abebe Owner",
    },
  });
  return NextResponse.json({ move });
}
