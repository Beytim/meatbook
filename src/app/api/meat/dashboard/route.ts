import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/utils";
import { getSettings } from "@/lib/api-helpers";
import type { PaymentMethod } from "@/lib/accounts";

// The dashboard = "Today's business". EVERYTHING on it is TODAY and comes from
// the same source (today's completed sales), so the numbers are always in sync:
//   Today's Sales total  ==  Cash + Mobile + Bank (by media)
// When a sale is recorded, all three update together.

interface SubBalance { detail: string | null; amount: number; }
interface AccountTree { total: number; subAccounts: SubBalance[]; }

export async function GET() {
  const settings = await getSettings();

  const today = periodRange("TODAY");
  // Single source of truth for the dashboard: today's completed sales.
  const todayWhere = { createdAt: { gte: today.from, lte: today.to }, status: "COMPLETED" };
  const todayRange = { createdAt: { gte: today.from, lte: today.to } };

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, todayByMethodDetail, todayPurchases, todayExpensesAgg, todayTopProducts, recentSales] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "TAKE_HOME" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "EAT_HERE" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: todayWhere, _sum: { total: true } }),
    db.purchase.findMany({ where: todayRange, include: { items: true } }),
    db.expense.aggregate({ where: todayRange, _sum: { amount: true } }),
    // Top products today (by revenue)
    db.saleItem.groupBy({ by: ["name"], where: { sale: todayWhere }, _sum: { total: true, kg: true }, _count: true }),
    // Recent sales (last 5)
    db.sale.findMany({ where: todayWhere, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
  ]);

  // Build a tree per method from TODAY's sales only.
  function buildTree(method: PaymentMethod): AccountTree {
    const byDetail = new Map<string, number>();
    for (const r of todayByMethodDetail) {
      if (r.paymentMethod !== method) continue;
      const key = r.paymentDetail ?? "";
      byDetail.set(key, (byDetail.get(key) ?? 0) + Number(r._sum.total ?? 0));
    }
    const subs: SubBalance[] = Array.from(byDetail.entries())
      .map(([k, v]) => ({ detail: k || null, amount: Math.round(v * 100) / 100 }))
      .filter((s) => Math.abs(s.amount) > 0.005)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const total = Math.round(subs.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    return { total, subAccounts: subs };
  }

  const cashTree = buildTree("CASH");
  const mobileTree = buildTree("MOBILE");
  const bankTree = buildTree("BANK");

  const todayRevenue = Number(todaySalesAgg._sum.total ?? 0);
  const treeSum = cashTree.total + mobileTree.total + bankTree.total;

  // ─── Stock & Money Flow (today) ─────────────────────────────────────
  // The owner's key question: "Did today's sales cover today's purchases?"
  const todayKgSold = Number(todaySalesAgg._sum.totalKg ?? 0);

  // Today's purchases: total amount + total kg + breakdown by animal type
  let purchaseAmount = 0;
  let purchaseKg = 0;
  const animalBreakdown: Record<string, { kg: number; amount: number; count: number }> = {};
  for (const p of todayPurchases) {
    purchaseAmount += p.total;
    for (const i of p.items) {
      purchaseKg += i.kg;
      const key = i.animalType || "OTHER";
      if (!animalBreakdown[key]) animalBreakdown[key] = { kg: 0, amount: 0, count: 0 };
      animalBreakdown[key].kg += i.kg;
      animalBreakdown[key].amount += i.total;
      animalBreakdown[key].count += 1;
    }
  }
  purchaseAmount = Math.round(purchaseAmount * 100) / 100;

  const todayExpenses = Number(todayExpensesAgg._sum.amount ?? 0);
  // Realized profit today = sales - purchases - expenses
  // (purchases = cost of the animals bought today; sales = revenue from cuts sold today)
  const profit = Math.round((todayRevenue - purchaseAmount - todayExpenses) * 100) / 100;

  // Profit status for color coding:
  //   loss     (profit < 0)            → red
  //   break-even (0 <= profit < 10% of purchases) → amber
  //   healthy   (profit >= 10% of purchases)      → green
  // When there are no purchases, base it on expenses instead.
  const profitBase = purchaseAmount > 0 ? purchaseAmount : (todayExpenses > 0 ? todayExpenses : 1);
  const profitMargin = profit / profitBase;
  let profitStatus: "loss" | "break_even" | "healthy";
  if (profit < 0) profitStatus = "loss";
  else if (profitMargin < 0.1) profitStatus = "break_even";
  else profitStatus = "healthy";

  // Coverage: did sales cover purchases? 0 = none, 1 = break-even, >1 = surplus
  const purchaseCoverage = purchaseAmount > 0 ? todayRevenue / purchaseAmount : (todayRevenue > 0 ? 1 : 0);

  return NextResponse.json({
    settings: { shopName: settings.shopName, currency: settings.currency },
    today: {
      salesCount: todaySales,
      revenue: todayRevenue,
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
    // Today's sales broken down by media — ALWAYS equals Today's Sales total.
    accounts: {
      cash: cashTree.total,
      mobile: mobileTree.total,
      bank: bankTree.total,
    },
    tree: {
      CASH: cashTree,
      MOBILE: mobileTree,
      BANK: bankTree,
    },
    // ─── Stock & Money Flow (today's business health) ───────────────
    flow: {
      todayKgSold,
      purchaseKg: Math.round(purchaseKg * 100) / 100,
      purchaseAmount,
      todayExpenses,
      todayRevenue,
      profit,
      profitMargin: Math.round(profitMargin * 1000) / 1000,
      profitStatus,
      purchaseCoverage: Math.round(purchaseCoverage * 1000) / 1000,
      // kg ratio: sold / purchased (1.0 = sold exactly what was bought today)
      kgRatio: purchaseKg > 0 ? Math.round((todayKgSold / purchaseKg) * 1000) / 1000 : 0,
    },
    // Today's purchases broken down by animal type (Ox/Sheep/Goat)
    todayPurchases: {
      count: todayPurchases.length,
      total: purchaseAmount,
      totalKg: Math.round(purchaseKg * 100) / 100,
      animalBreakdown: Object.entries(animalBreakdown).map(([type, v]) => ({
        type,
        kg: Math.round(v.kg * 100) / 100,
        amount: Math.round(v.amount * 100) / 100,
        count: v.count,
        // derived per-kg cost
        perKg: v.kg > 0 ? Math.round((v.amount / v.kg) * 100) / 100 : 0,
      })).sort((a, b) => b.amount - a.amount),
    },
    // Top products today (by revenue)
    topProducts: todayTopProducts
      .map((p) => ({ name: p.name, revenue: Number(p._sum.total ?? 0), kg: Number(p._sum.kg ?? 0), count: p._count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    // Recent sales (last 5)
    recentSales: recentSales.map((s) => ({
      number: String(s.number).padStart(6, "0"),
      type: s.type,
      total: s.total,
      totalKg: s.totalKg,
      paymentMethod: s.paymentMethod,
      paymentDetail: s.paymentDetail,
      cashierName: s.cashierName,
      itemCount: s.items.length,
      createdAt: s.createdAt,
    })),
    // integrity check: tree sum must equal today's revenue
    _sync: { todayRevenue, treeSum, matched: Math.abs(todayRevenue - treeSum) < 0.01 },
  });
}
