import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/utils";
import { getSettings } from "@/lib/api-helpers";
import type { PaymentMethod } from "@/lib/accounts";

// sub-account balance: sum of money moves (IN positive, OUT negative) +
// completed sales by method/detail - expenses by method/detail - purchases by method/detail
interface SubBalance {
  detail: string | null;
  amount: number;
}

export async function GET() {
  const settings = await getSettings();

  const today = periodRange("TODAY");
  const todayWhere = { createdAt: { gte: today.from, lte: today.to }, status: "COMPLETED" };

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, cashMoves, mobileMoves, bankMoves, todayByMethod] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "TAKE_HOME" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "EAT_HERE" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    db.moneyMove.findMany({ where: { account: "CASH" } }),
    db.moneyMove.findMany({ where: { account: "MOBILE" } }),
    db.moneyMove.findMany({ where: { account: "BANK" } }),
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: todayWhere, _sum: { total: true } }),
  ]);

  // all-time sales/expense/purchase grouped by method+detail for balances
  const [salesByMD, expensesByMD, purchasesByMD] = await Promise.all([
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: { status: "COMPLETED" }, _sum: { total: true } }),
    db.expense.groupBy({ by: ["paymentMethod", "paymentDetail"], _sum: { amount: true } }),
    db.purchase.groupBy({ by: ["paymentMethod", "paymentDetail"], _sum: { total: true } }),
  ]);

  function mdKey(m: string, d: string | null) { return `${m}|${d ?? ""}`; }
  const salesMap = new Map<string, number>();
  salesByMD.forEach((r) => salesMap.set(mdKey(r.paymentMethod, r.paymentDetail), Number(r._sum.total ?? 0)));
  const expMap = new Map<string, number>();
  expensesByMD.forEach((r) => expMap.set(mdKey(r.paymentMethod, r.paymentDetail), Number(r._sum.amount ?? 0)));
  const purMap = new Map<string, number>();
  purchasesByMD.forEach((r) => purMap.set(mdKey(r.paymentMethod, r.paymentDetail), Number(r._sum.total ?? 0)));

  function buildTree(method: PaymentMethod, moves: { detail: string | null; amount: number; direction: string }[]) {
    const byDetail = new Map<string, number>();
    for (const m of moves) {
      const key = m.detail ?? "";
      const cur = byDetail.get(key) ?? 0;
      byDetail.set(key, cur + (m.direction === "IN" ? m.amount : -Math.abs(m.amount)));
    }
    // add sales - expenses - purchases for this method, grouped by detail
    const methodSales = salesByMD.filter((r) => r.paymentMethod === method);
    methodSales.forEach((r) => {
      const key = r.paymentDetail ?? "";
      byDetail.set(key, (byDetail.get(key) ?? 0) + Number(r._sum.total ?? 0));
    });
    const methodExp = expensesByMD.filter((r) => r.paymentMethod === method);
    methodExp.forEach((r) => {
      const key = r.paymentDetail ?? "";
      byDetail.set(key, (byDetail.get(key) ?? 0) - Number(r._sum.amount ?? 0));
    });
    const methodPur = purchasesByMD.filter((r) => r.paymentMethod === method);
    methodPur.forEach((r) => {
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

  const cashTree = buildTree("CASH", cashMoves);
  const mobileTree = buildTree("MOBILE", mobileMoves);
  const bankTree = buildTree("BANK", bankMoves);

  return NextResponse.json({
    settings: { shopName: settings.shopName, currency: settings.currency },
    today: {
      salesCount: todaySales,
      revenue: Number(todaySalesAgg._sum.total ?? 0),
      kgSold: Number(todaySalesAgg._sum.totalKg ?? 0),
      takeHome: {
        revenue: Number(takeHomeAgg._sum.total ?? 0),
        count: takeHomeAgg._count,
        kg: Number(takeHomeAgg._sum.totalKg ?? 0),
      },
      eatHere: {
        revenue: Number(eatHereAgg._sum.total ?? 0),
        count: eatHereAgg._count,
        kg: Number(eatHereAgg._sum.totalKg ?? 0),
      },
    },
    lastSaleNumber: lastSale?.number ?? null,
    openSession: openSession
      ? { id: openSession.id, opening: openSession.opening, openedAt: openSession.openedAt, openedBy: openSession.openedBy }
      : null,
    accounts: {
      cash: cashTree.total,
      mobile: mobileTree.total,
      bank: bankTree.total,
    },
    // tree breakdown: each method -> total + sub-accounts (Telebirr/Mpesa/CBE/United/Zemen...)
    tree: {
      CASH: cashTree,
      MOBILE: mobileTree,
      BANK: bankTree,
    },
  });
}
