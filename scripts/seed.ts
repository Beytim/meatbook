// Standalone seed script — run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

async function main() {
  const existing = await db.product.count();
  if (existing > 0) { console.log("already seeded, skipping"); return; }

  const products = [];
  for (const p of PRODUCTS) products.push(await db.product.create({ data: p }));
  for (const s of STAFF) await db.staff.create({ data: s });

  await db.setting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  await db.counter.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", saleNumber: 1 } });

  const openedAt = new Date(); openedAt.setHours(10, 30, 0, 0);
  await db.cashSession.create({ data: { opening: 5000, status: "OPEN", openedBy: "Abebe Owner", openedAt } });

  await db.moneyMove.createMany({
    data: [
      { direction: "IN", account: "CASH", amount: 16900.4, reason: "Opening balance" },
      { direction: "IN", account: "MOBILE", amount: 9205, reason: "Opening balance" },
      { direction: "OUT", account: "BANK", amount: 104062, reason: "Opening balance (overdraft)" },
    ],
  });

  const types = ["TAKE_HOME", "EAT_HERE"];
  const payments: [string, string?][] = [["CASH"], ["MOBILE", "Telebirr"], ["BANK", "CBE"]];
  const cashiers = ["Abebe Owner", "Sara Manager", "Dawit Cashier"];
  let saleNumber = 1;
  const now = new Date();

  async function makeSale(daysAgo: number, hour: number, minute: number) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    const type = pick(types);
    const itemCount = randInt(1, 3);
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    const pool = shuffled.slice(0, itemCount);
    const seen = new Set<string>();
    const items = pool.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).map((p) => {
      const unitPrice = type === "TAKE_HOME" ? p.priceTakeHome : p.priceEatHere;
      const kg = Math.round(rand(0.5, 3) * 100) / 100;
      return { productId: p.id, name: p.name, unitPrice, kg, total: Math.round(unitPrice * kg * 100) / 100 };
    });
    const total = items.reduce((s, i) => s + i.total, 0);
    const totalKg = items.reduce((s, i) => s + i.kg, 0);
    const [pm, pd] = pick(payments);
    await db.sale.create({
      data: {
        number: saleNumber++, type,
        paymentMethod: pm, paymentDetail: pd ?? null,
        total: Math.round(total * 100) / 100, totalKg: Math.round(totalKg * 100) / 100,
        status: "COMPLETED", cashierName: pick(cashiers), createdAt: date,
        items: { create: items.map((i) => ({ productId: i.productId, name: i.name, unitPrice: i.unitPrice, kg: i.kg, total: i.total })) },
      },
    });
  }

  for (const [d, h, m] of [[1,12,0],[1,14,13],[1,15,33],[1,16,26],[1,18,39],[1,22,5],[2,12,0],[2,14,13],[2,16,26],[2,18,39],[3,12,0],[3,14,13],[3,16,26],[3,18,39],[4,15,33],[4,16,26],[5,12,0],[6,14,13]] as [number,number,number][]) {
    await makeSale(d, h, m);
  }

  await db.counter.update({ where: { id: "singleton" }, data: { saleNumber: saleNumber } });
  await db.sale.update({ where: { number: 1 }, data: { status: "REFUNDED" } });
  await db.sale.update({ where: { number: 17 }, data: { status: "VOIDED" } });

  console.log(`seeded OK: ${products.length} products, ${saleNumber - 1} sales, ${STAFF.length} staff`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
