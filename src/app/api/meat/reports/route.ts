import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "30D";
  const { from, to } = periodRange(period);
  const createdAtRange = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };

  const completedWhere = { status: "COMPLETED" as const, ...createdAtRange };

  const [salesAgg, salesCount, kgAgg, byType, byMethod, byMethodDetail, byProduct, expensesAgg, expensesByMD, purchasesAgg, purchasesByMD, wastageAgg] = await Promise.all([
    db.sale.aggregate({ where: completedWhere, _sum: { total: true } }),
    db.sale.count({ where: completedWhere }),
    db.sale.aggregate({ where: completedWhere, _sum: { totalKg: true } }),
    db.sale.groupBy({ by: ["type"], where: completedWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.groupBy({ by: ["paymentMethod"], where: completedWhere, _sum: { total: true } }),
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: completedWhere, _sum: { total: true } }),
    db.saleItem.groupBy({ by: ["productId", "name"], where: { sale: completedWhere }, _sum: { total: true, kg: true }, _count: true }),
    db.expense.aggregate({ where: createdAtRange, _sum: { amount: true } }),
    db.expense.groupBy({ by: ["paymentMethod", "paymentDetail"], where: createdAtRange, _sum: { amount: true } }),
    db.purchase.aggregate({ where: createdAtRange, _sum: { total: true } }),
    db.purchase.groupBy({ by: ["paymentMethod", "paymentDetail"], where: createdAtRange, _sum: { total: true } }),
    db.wastage.aggregate({ where: createdAtRange, _sum: { kg: true } }),
  ]);

  const netRevenue = Number(salesAgg._sum.total ?? 0);
  const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
  const totalPurchases = Number(purchasesAgg._sum.total ?? 0);
  const totalWastageKg = Number(wastageAgg._sum.kg ?? 0);
  // simple profit: revenue - expenses - purchases (purchases = cost of meat)
  const profit = netRevenue - totalExpenses - totalPurchases;

  const takeHome = byType.find((t) => t.type === "TAKE_HOME");
  const eatHere = byType.find((t) => t.type === "EAT_HERE");

  const methodTotal = byMethod.reduce((s, m) => s + Number(m._sum.total ?? 0), 0) || 1;

  // sub-account breakdown for each method (Telebirr/M-Pesa/CBE/United/Zemen...)
  const subAccountsByMethod = (method: string) =>
    byMethodDetail
      .filter((r) => r.paymentMethod === method)
      .map((r) => ({ detail: r.paymentDetail, revenue: Number(r._sum.total ?? 0) }))
      .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    period,
    netRevenue,
    salesCount,
    kgSold: Number(kgAgg._sum.totalKg ?? 0),
    split: {
      takeHome: { revenue: Number(takeHome?._sum.total ?? 0), count: takeHome?._count ?? 0, kg: Number(takeHome?._sum.totalKg ?? 0) },
      eatHere: { revenue: Number(eatHere?._sum.total ?? 0), count: eatHere?._count ?? 0, kg: Number(eatHere?._sum.totalKg ?? 0) },
    },
    paymentMethods: byMethod.map((m) => ({
      method: m.paymentMethod,
      revenue: Number(m._sum.total ?? 0),
      share: Number(m._sum.total ?? 0) / methodTotal,
      subAccounts: subAccountsByMethod(m.paymentMethod),
    })),
    // money-out breakdown by sub-account too
    expenseSubAccounts: expensesByMD.map((r) => ({ method: r.paymentMethod, detail: r.paymentDetail, amount: Number(r._sum.amount ?? 0) })),
    purchaseSubAccounts: purchasesByMD.map((r) => ({ method: r.paymentMethod, detail: r.paymentDetail, amount: Number(r._sum.total ?? 0) })),
    products: byProduct
      .map((p) => ({ name: p.name, revenue: Number(p._sum.total ?? 0), kg: Number(p._sum.kg ?? 0), count: p._count }))
      .sort((a, b) => b.revenue - a.revenue),
    expenses: totalExpenses,
    purchases: totalPurchases,
    wastageKg: totalWastageKg,
    profit,
  });
}
