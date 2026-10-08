import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";
import type { PeriodKey } from "@/lib/utils";
import { periodRange } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as PeriodKey) || "TODAY";
  const category = searchParams.get("category");
  const q = searchParams.get("q") || "";
  const { from, to } = periodRange(period);
  const where: Record<string, unknown> = period === "ALL" ? {} : { createdAt: { gte: from, lte: to } };
  if (category) where.category = category;

  let expenses = await db.expense.findMany({ where: where as never, orderBy: { createdAt: "desc" } });
  if (q) {
    const ql = q.toLowerCase();
    expenses = expenses.filter((e) => e.category.toLowerCase().includes(ql) || e.note?.toLowerCase().includes(ql) || e.userName?.toLowerCase().includes(ql));
  }
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const categories = await db.expense.groupBy({ by: ["category"], _sum: { amount: true }, _count: true });
  return NextResponse.json({ expenses, stats: { total, count: expenses.length }, categories });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { category, amount, note, paymentMethod, paymentDetail, frequency, userName } = body;
  if (!category || !amount) return NextResponse.json({ error: "category and amount required" }, { status: 400 });
  const method = (paymentMethod || "CASH").toUpperCase();
  const freq = (frequency || "ONE_TIME").toUpperCase() === "MONTHLY" ? "MONTHLY" : "ONE_TIME";
  const expense = await db.expense.create({
    data: { category: String(category), amount: Number(amount), note: note || null, paymentMethod: method, paymentDetail: method === "CASH" ? null : (paymentDetail || null), frequency: freq, userName: userName || "Abebe Owner" },
  });
  await audit("EXPENSE_CREATE", `${category} expense · Br ${Number(amount).toFixed(2)} (${freq === "MONTHLY" ? "monthly" : "one-time"})`, { name: userName }, { expenseId: expense.id });
  return NextResponse.json({ expense });
}
