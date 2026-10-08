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
  const yesterday = periodRange("YESTERDAY");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  // Single source of truth for the dashboard: today's completed sales.
  const todayWhere = { createdAt: { gte: today.from, lte: today.to }, status: "COMPLETED" };
  const todayRange = { createdAt: { gte: today.from, lte: today.to } };
  const yesterdayRange = { createdAt: { gte: yesterday.from, lte: yesterday.to } };
  const createdAtRange = todayRange;

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, todayByMethodDetail, todayPurchases, oneTimeExpensesAgg, monthlyExpensesAgg, todayTopProducts, recentSales, debtsAgg, supplierDebitAgg, supplierCreditAgg, yesterdayAgg, monthAgg, weekAgg, methodSplit, wastageToday] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "TAKE_HOME" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "EAT_HERE" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: todayWhere, _sum: { total: true } }),
    db.purchase.findMany({ where: todayRange, include: { items: true } }),
    db.expense.aggregate({ where: { ...todayRange, frequency: "ONE_TIME" }, _sum: { amount: true } }),
    // Monthly expenses recorded this month (for daily amortization: ÷30)
    db.expense.aggregate({ where: { frequency: "MONTHLY", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    // Top products today (by revenue)
    db.saleItem.groupBy({ by: ["name"], where: { sale: todayWhere }, _sum: { total: true, kg: true }, _count: true }),
    // Recent sales (last 5)
    db.sale.findMany({ where: todayWhere, orderBy: { createdAt: "desc" }, take: 5, include: { items: true } }),
    // Customer debts outstanding (all-time)
    db.debt.aggregate({ where: { status: "OPEN" }, _sum: { amount: true, paid: true } }),
    // Supplier balance (all-time: total debit - total credit)
    db.ledgerEntry.aggregate({ where: { kind: "DEBIT" }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { kind: "CREDIT" }, _sum: { amount: true } }),
    // ─── Missing metrics for world-standard dashboard ───────────────
    // Yesterday's revenue for comparison
    db.sale.aggregate({ where: { status: "COMPLETED", createdAt: { gte: yesterdayRange.from, lte: yesterdayRange.to } }, _sum: { total: true, totalKg: true }, _count: true }),
    // Month-to-date revenue
    db.sale.aggregate({ where: { status: "COMPLETED", createdAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    // Week-to-date revenue
    db.sale.aggregate({ where: { status: "COMPLETED", createdAt: { gte: weekStart } }, _sum: { total: true }, _count: true }),
    // Payment method split for today (for donut)
    db.sale.groupBy({ by: ["paymentMethod"], where: todayWhere, _sum: { total: true } }),
    // Wastage today
    db.wastage.aggregate({ where: createdAtRange, _sum: { kg: true }, _count: true }),
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

  // Expenses: one-time (full amount today) + monthly (÷30 daily amortization)
  const oneTimeExpenses = Number(oneTimeExpensesAgg._sum.amount ?? 0);
  const monthlyExpensesTotal = Number(monthlyExpensesAgg._sum.amount ?? 0);
  const monthlyDailyShare = Math.round((monthlyExpensesTotal / 30) * 100) / 100; // daily amortized
  const todayExpenses = Math.round((oneTimeExpenses + monthlyDailyShare) * 100) / 100;
  // Realized profit today = sales - purchases - expenses (one-time + daily share of monthly)
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

  // Compute expected cash for the open drawer session.
  // This is TODAY's expected: opening + today's cash sales - today's cash
  // expenses - today's cash purchases + today's cash money-in - today's cash
  // money-out. The dashboard is "Today's business" so we use today's range.
  let expectedCash = openSession?.opening ?? 0;
  if (openSession) {
    const cashWhere = { createdAt: { gte: today.from, lte: today.to } };
    const [cashSales, cashExpenses, cashPurchases, cashMovesIn, cashMovesOut] = await Promise.all([
      db.sale.aggregate({ where: { status: "COMPLETED", paymentMethod: "CASH", ...cashWhere }, _sum: { total: true } }),
      db.expense.aggregate({ where: { paymentMethod: "CASH", ...cashWhere }, _sum: { amount: true } }),
      db.purchase.aggregate({ where: { paymentMethod: "CASH", ...cashWhere }, _sum: { total: true } }),
      // Exclude "Opening balance" moves — they're starting balances, not today's activity
      db.moneyMove.aggregate({ where: { account: "CASH", direction: "IN", ...cashWhere, reason: { not: "Opening balance" } }, _sum: { amount: true } }),
      db.moneyMove.aggregate({ where: { account: "CASH", direction: "OUT", ...cashWhere, reason: { not: "Opening balance" } }, _sum: { amount: true } }),
    ]);
    expectedCash = (openSession.opening)
      + Number(cashSales._sum.total ?? 0)
      - Number(cashExpenses._sum.amount ?? 0)
      - Number(cashPurchases._sum.total ?? 0)
      + Number(cashMovesIn._sum.amount ?? 0)
      - Math.abs(Number(cashMovesOut._sum.amount ?? 0));
    expectedCash = Math.round(expectedCash * 100) / 100;
  }

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
      ? { id: openSession.id, opening: openSession.opening, openedAt: openSession.openedAt, openedBy: openSession.openedBy, expectedCash }
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
      expenseBreakdown: { oneTime: oneTimeExpenses, monthlyTotal: monthlyExpensesTotal, monthlyDailyShare },
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
    // ─── Cross-module: customer debts + supplier balances ──────────
    debtsOutstanding: Math.round((Number(debtsAgg._sum.amount ?? 0) - Number(debtsAgg._sum.paid ?? 0)) * 100) / 100,
    supplierBalance: Math.round((Number(supplierDebitAgg._sum.amount ?? 0) - Number(supplierCreditAgg._sum.amount ?? 0)) * 100) / 100,
    // ─── World-standard metrics ─────────────────────────────────────
    avgSale: todaySales > 0 ? Math.round((todayRevenue / todaySales) * 100) / 100 : 0,
    yesterdayRevenue: Number(yesterdayAgg._sum.total ?? 0),
    yesterdayCount: yesterdayAgg._count,
    revenueChange: yesterdayAgg._sum.total ? Math.round(((todayRevenue - Number(yesterdayAgg._sum.total)) / Number(yesterdayAgg._sum.total)) * 1000) / 10 : 0,
    monthRevenue: Number(monthAgg._sum.total ?? 0),
    weekRevenue: Number(weekAgg._sum.total ?? 0),
    weekCount: weekAgg._count,
    methodSplit: methodSplit.map((m) => ({
      method: m.paymentMethod,
      revenue: Number(m._sum.total ?? 0),
      pct: todayRevenue > 0 ? Math.round((Number(m._sum.total ?? 0) / todayRevenue) * 1000) / 10 : 0,
    })),
    wastageTodayKg: Number(wastageToday._sum.kg ?? 0),
    wastageTodayCount: wastageToday._count,
    // integrity check: tree sum must equal today's revenue
    _sync: { todayRevenue, treeSum, matched: Math.abs(todayRevenue - treeSum) < 0.01 },
  });
}
