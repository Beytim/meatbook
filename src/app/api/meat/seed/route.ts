import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Seed demo data for MeatBook. Idempotent — only seeds if DB is empty.
const PRODUCTS = [
  { name: "Meat", emoji: "🥩", priceTakeHome: 1300, priceEatHere: 1600 },
  { name: "Steak", emoji: "🍖", priceTakeHome: 1500, priceEatHere: 1800 },
  { name: "Ribs", emoji: "🦴", priceTakeHome: 1300, priceEatHere: 1600 },
  { name: "Mince", emoji: "🥩", priceTakeHome: 1100, priceEatHere: 1350 },
  { name: "Liver", emoji: "🫀", priceTakeHome: 600, priceEatHere: 750 },
  { name: "Heart", emoji: "❤️", priceTakeHome: 700, priceEatHere: 870 },
  { name: "Kidney", emoji: "🫘", priceTakeHome: 500, priceEatHere: 620 },
  { name: "Fat", emoji: "🧈", priceTakeHome: 400, priceEatHere: 500 },
];

const STAFF = [
  { name: "Abebe Owner", role: "OWNER", pin: "1234" },
  { name: "Sara Manager", role: "MANAGER", pin: "2345" },
  { name: "Hanan Abebe", role: "MANAGER", pin: "3456" },
  { name: "Dawit Cashier", role: "CASHIER", pin: "4567" },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export async function POST() {
  const existingProducts = await db.product.count();
  if (existingProducts > 0) {
    return NextResponse.json({ ok: true, message: "already seeded", skipped: true });
  }

  const products = await Promise.all(
    PRODUCTS.map((p) => db.product.create({ data: p }))
  );

  await Promise.all(STAFF.map((s) => db.staff.create({ data: s })));

  await db.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  await db.counter.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", saleNumber: 1 },
  });

  const openedAt = new Date();
  openedAt.setHours(10, 30, 0, 0);
  await db.cashSession.create({
    data: { opening: 5000, status: "OPEN", openedBy: "Abebe Owner", openedAt },
  });

  await db.moneyMove.createMany({
    data: [
      { direction: "IN", account: "CASH", amount: 16900.4, reason: "Opening balance" },
      { direction: "IN", account: "MOBILE", amount: 9205, reason: "Opening balance" },
      { direction: "OUT", account: "BANK", amount: 104062, reason: "Opening balance (overdraft)" },
    ],
  });

  const types = ["TAKE_HOME", "EAT_HERE"];
  const payments: [string, string?][] = [
    ["CASH"],
    ["MOBILE", "Telebirr"],
    ["BANK", "CBE"],
  ];
  const cashiers = ["Abebe Owner", "Sara Manager", "Dawit Cashier"];

  let saleNumber = 1;
  const now = new Date();

  async function makeSale(daysAgo: number, hour: number, minute: number) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);

    const type = pick(types);
    const itemCount = randInt(1, 3);
    const chosen = Array.from({ length: itemCount }).map(() => pick(products));
    const seen = new Set<string>();
    const items = chosen
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .map((p) => {
        const unitPrice = type === "TAKE_HOME" ? p.priceTakeHome : p.priceEatHere;
        const kg = Math.round(rand(0.5, 3) * 100) / 100;
        return { product: p, unitPrice, kg, total: Math.round(unitPrice * kg * 100) / 100 };
      });
    const total = items.reduce((s, i) => s + i.total, 0);
    const totalKg = items.reduce((s, i) => s + i.kg, 0);
    const [pm, pd] = pick(payments);

    await db.sale.create({
      data: {
        number: saleNumber++,
        type,
        paymentMethod: pm,
        paymentDetail: pd ?? null,
        total: Math.round(total * 100) / 100,
        totalKg: Math.round(totalKg * 100) / 100,
        status: "COMPLETED",
        cashierName: pick(cashiers),
        createdAt: date,
        items: {
          create: items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            unitPrice: i.unitPrice,
            kg: i.kg,
            total: i.total,
          })),
        },
      },
    });
  }

  await makeSale(1, 12, 0);
  await makeSale(1, 14, 13);
  await makeSale(1, 15, 33);
  await makeSale(1, 16, 26);
  await makeSale(1, 18, 39);
  await makeSale(1, 22, 5);
  await makeSale(2, 12, 0);
  await makeSale(2, 14, 13);
  await makeSale(2, 16, 26);
  await makeSale(2, 18, 39);
  await makeSale(3, 12, 0);
  await makeSale(3, 14, 13);
  await makeSale(3, 16, 26);
  await makeSale(3, 18, 39);
  await makeSale(4, 15, 33);
  await makeSale(4, 16, 26);
  await makeSale(5, 12, 0);
  await makeSale(6, 14, 13);

  await db.counter.update({ where: { id: "singleton" }, data: { saleNumber: saleNumber } });

  // void two of them to populate the refunded/voided list
  await db.sale.update({ where: { number: 1 }, data: { status: "REFUNDED" } });
  await db.sale.update({ where: { number: 17 }, data: { status: "VOIDED" } });

  return NextResponse.json({ ok: true, salesCreated: saleNumber - 1 });
}
