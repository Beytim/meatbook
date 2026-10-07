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

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, todayByMethodDetail] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "TAKE_HOME" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "EAT_HERE" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    // TODAY's sales grouped by method + sub-account detail — same data as Today's Sales.
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: todayWhere, _sum: { total: true } }),
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
    // integrity check: tree sum must equal today's revenue
    _sync: { todayRevenue, treeSum, matched: Math.abs(todayRevenue - treeSum) < 0.01 },
  });
}
