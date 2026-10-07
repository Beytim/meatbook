import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { periodRange } from "@/lib/utils";
import { getSettings } from "@/lib/api-helpers";

export async function GET() {
  const settings = await getSettings();

  const today = periodRange("TODAY");
  const todayWhere = { createdAt: { gte: today.from, lte: today.to }, status: "COMPLETED" };

  const [todaySales, todaySalesAgg, takeHomeAgg, eatHereAgg, lastSale, openSession, cash, mobile, bank] = await Promise.all([
    db.sale.count({ where: todayWhere }),
    db.sale.aggregate({ where: todayWhere, _sum: { total: true, totalKg: true }, _count: true }),
    db.sale.aggregate({
      where: { ...todayWhere, type: "TAKE_HOME" },
      _sum: { total: true, totalKg: true }, _count: true,
    }),
    db.sale.aggregate({
      where: { ...todayWhere, type: "EAT_HERE" },
      _sum: { total: true, totalKg: true }, _count: true,
    }),
    db.sale.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } }),
    db.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    db.moneyMove.aggregate({ where: { account: "CASH" }, _sum: { amount: true } }),
    db.moneyMove.aggregate({ where: { account: "MOBILE" }, _sum: { amount: true } }),
    db.moneyMove.aggregate({ where: { account: "BANK" }, _sum: { amount: true } }),
  ]);

  // compute live account balances from moves
  function balance(sum: { _sum: { amount: number | null } }) {
    return Number(sum._sum.amount ?? 0);
  }
  // Add today's sales to cash/mobile/bank for the displayed balances
  const todayByMethod = await db.sale.groupBy({
    by: ["paymentMethod"],
    where: todayWhere,
    _sum: { total: true },
  });
  const methodSum = (m: string) => todayByMethod.find((g) => g.paymentMethod === m)?._sum.total ?? 0;

  const cashBalance = balance(cash) + methodSum("CASH");
  const mobileBalance = balance(mobile) + methodSum("MOBILE");
  const bankBalance = balance(bank) + methodSum("BANK");

  return NextResponse.json({
    settings: {
      shopName: settings.shopName,
      currency: settings.currency,
    },
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
      ? {
          id: openSession.id,
          opening: openSession.opening,
          openedAt: openSession.openedAt,
          openedBy: openSession.openedBy,
        }
      : null,
    accounts: {
      cash: cashBalance,
      mobile: mobileBalance,
      bank: bankBalance,
    },
  });
}
