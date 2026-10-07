import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/utils";
import { getSettings } from "@/lib/api-helpers";
import type { PaymentMethod } from "@/lib/accounts";

// The dashboard answers ONE question: "Through what media did money come in from sales?"
// accounts.cash/mobile/bank = sum of COMPLETED SALES only (no opening balances, expenses,
// purchases, or manual money moves — those live in the Money view).
// Each account breaks down into its sub-accounts (Telebirr/M-Pesa, CBE/United/Zemen…).

interface SubBalance { detail: string | null; amount: number; }
interface AccountTree { total: number; subAccounts: SubBalance[]; }

export async function GET() {
  const settings = await getSettings();

  const today = periodRange("TODAY");
  const todayWhere = { createdAt: { gte: today.from, lte: today.to }, status: "COMPLETED" };

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, salesByMethodDetail] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "TAKE_HOME" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({ where: { ...todayWhere, type: "EAT_HERE" }, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    // ALL completed sales grouped by method + sub-account detail (for the all-time-by-media tree)
    db.sale.groupBy({ by: ["paymentMethod", "paymentDetail"], where: { status: "COMPLETED" }, _sum: { total: true } }),
  ]);

  // Build a tree per method from SALES ONLY.
  function buildTree(method: PaymentMethod): AccountTree {
    const byDetail = new Map<string, number>();
    for (const r of salesByMethodDetail) {
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
    // Sales-by-media only (always positive — it's revenue received)
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
  });
}
