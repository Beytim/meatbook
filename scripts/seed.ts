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

  // Opening balances broken down by sub-account so the dashboard tree shows real data:
  // Mobile Br 10,000 = Telebirr 6,000 + M-Pesa 4,000
  // Bank Br 10,000 = CBE 5,000 + United 3,000 + Zemen 2,000
  // (plus a loan OUT on CBE to create the overdraft feel)
  await db.moneyMove.createMany({
    data: [
      { direction: "IN", account: "CASH", detail: null, amount: 16900.4, reason: "Opening balance" },
      { direction: "IN", account: "MOBILE", detail: "Telebirr", amount: 6000, reason: "Opening balance" },
      { direction: "IN", account: "MOBILE", detail: "M-Pesa", amount: 4000, reason: "Opening balance" },
      { direction: "IN", account: "BANK", detail: "CBE", amount: 5000, reason: "Opening balance" },
      { direction: "IN", account: "BANK", detail: "United", amount: 3000, reason: "Opening balance" },
      { direction: "IN", account: "BANK", detail: "Zemen", amount: 2000, reason: "Opening balance" },
      { direction: "OUT", account: "BANK", detail: "CBE", amount: 104062, reason: "Loan repayment (overdraft)" },
      { direction: "OUT", account: "MOBILE", detail: "Telebirr", amount: 795, reason: "Airtime / float top-up" },
    ],
  });

  // A couple of expenses + a purchase so money-out also shows sub-account detail.
  await db.expense.createMany({
    data: [
      { category: "Rent", amount: 4000, note: "Shop rent — October", paymentMethod: "BANK", paymentDetail: "CBE", userName: "Abebe Owner" },
      { category: "Electricity", amount: 850, note: "Meter top-up", paymentMethod: "MOBILE", paymentDetail: "Telebirr", userName: "Sara Manager" },
      { category: "Transport", amount: 300, note: "Fuel", paymentMethod: "CASH", userName: "Dawit Cashier" },
    ],
  });

  // Realistic whole-animal purchases. A butcher buys ox/sheep/goat by weight at
  // a negotiated price (amount entered manually, NOT kg × unitCost).
  // One purchase is dated TODAY so the dashboard stock-flow card has data.
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  async function makePurchase(date: Date, supplier: string, method: string, detail: string | null, items: { animalType: string; name: string; kg: number; total: number }[]) {
    const total = items.reduce((s, i) => s + i.total, 0);
    await db.purchase.create({
      data: {
        supplier,
        note: `Whole-animal purchase`,
        paymentMethod: method,
        paymentDetail: detail,
        total,
        userName: "Abebe Owner",
        createdAt: date,
        items: {
          create: items.map((i) => ({
            animalType: i.animalType,
            name: i.name,
            kg: i.kg,
            unitCost: Math.round((i.total / i.kg) * 100) / 100, // derived, for display
            total: i.total,
          })),
        },
      },
    });
  }

  // TODAY: 1 ox @ 180kg @ Br 54,000 (so dashboard shows today's purchase vs sales)
  await makePurchase(today, "Kera Slaughterhouse", "BANK", "CBE", [
    { animalType: "OX", name: "Ox", kg: 180, total: 54000 },
  ]);
  // Yesterday: 1 ox @ 160kg @ Br 48,000 + 2 sheep @ 25kg @ Br 5,000 each
  await makePurchase(yesterday, "Kera Slaughterhouse", "BANK", "CBE", [
    { animalType: "OX", name: "Ox", kg: 160, total: 48000 },
    { animalType: "SHEEP", name: "Sheep", kg: 50, total: 10000 },
  ]);
  // 3 days ago: 1 goat @ 22kg @ Br 4,400
  const d3 = new Date(); d3.setDate(d3.getDate() - 3);
  await makePurchase(d3, "Addis Ababa Livestock Market", "MOBILE", "Telebirr", [
    { animalType: "GOAT", name: "Goat", kg: 22, total: 4400 },
  ]);

  const types = ["TAKE_HOME", "EAT_HERE"];
  // Sales: spread across banks/mobile providers so the breakdown is rich.
  const payments: [string, string?][] = [
    ["CASH", null],
    ["MOBILE", "Telebirr"],
    ["MOBILE", "M-Pesa"],
    ["BANK", "CBE"],
    ["BANK", "United"],
    ["BANK", "Zemen"],
    ["BANK", "Awash"],
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

  // ─── Customers & Debts ──────────────────────────────────────────────
  const customers = [
    { name: "Abebe Kebede", phone: "+251 911 111 111" },
    { name: "Helen Tesfaye", phone: "+251 911 222 222" },
    { name: "Yonas Girma", phone: "+251 911 333 333" },
    { name: "Meron Alemu", phone: "+251 911 444 444" },
  ];
  const custRecords = [];
  for (const c of customers) {
    custRecords.push(await db.customer.create({ data: c }));
  }

  // Debts: some open, some partially paid, some settled
  const debts = [
    { customerIdx: 0, amount: 1500, paid: 0, status: "OPEN", daysAgo: 2, note: "Meat on credit — weekend" },
    { customerIdx: 1, amount: 800, paid: 300, status: "OPEN", daysAgo: 5, note: "Partial payment" },
    { customerIdx: 2, amount: 2000, paid: 2000, status: "SETTLED", daysAgo: 10, note: "Fully paid" },
    { customerIdx: 3, amount: 650, paid: 0, status: "OPEN", daysAgo: 1, note: "Liver + Heart" },
  ];
  for (const d of debts) {
    const date = new Date(); date.setDate(date.getDate() - d.daysAgo);
    const debt = await db.debt.create({
      data: {
        customerId: custRecords[d.customerIdx].id,
        amount: d.amount,
        paid: d.paid,
        status: d.status,
        note: d.note,
        userName: "Abebe Owner",
        createdAt: date,
      },
    });
    // if partially paid, add a payment record
    if (d.paid > 0) {
      const payDate = new Date(date); payDate.setDate(payDate.getDate() + 1);
      await db.debtPayment.create({
        data: { debtId: debt.id, amount: d.paid, paymentMethod: "CASH", note: "Initial payment", userName: "Abebe Owner", createdAt: payDate },
      });
    }
  }

  // ─── Suppliers & Ledger ─────────────────────────────────────────────
  const suppliers = [
    { name: "Kera Slaughterhouse", phone: "+251 911 555 555" },
    { name: "Addis Ababa Livestock Market", phone: "+251 911 666 666" },
    { name: "Shola Meat Suppliers", phone: "+251 911 777 777" },
  ];
  const supRecords = [];
  for (const s of suppliers) {
    supRecords.push(await db.supplier.create({ data: s }));
  }

  // Ledger entries: debits (credit purchases) + credits (payments)
  const ledger = [
    { supIdx: 0, kind: "DEBIT", amount: 54000, daysAgo: 1, note: "1 Ox @ 180kg", method: null, detail: null },
    { supIdx: 0, kind: "CREDIT", amount: 20000, daysAgo: 0, note: "Partial payment", method: "BANK", detail: "CBE" },
    { supIdx: 1, kind: "DEBIT", amount: 4400, daysAgo: 3, note: "1 Goat @ 22kg", method: null, detail: null },
    { supIdx: 2, kind: "DEBIT", amount: 10000, daysAgo: 7, note: "2 Sheep @ 50kg", method: null, detail: null },
    { supIdx: 2, kind: "CREDIT", amount: 10000, daysAgo: 5, note: "Full payment", method: "MOBILE", detail: "Telebirr" },
  ];
  for (const l of ledger) {
    const date = new Date(); date.setDate(date.getDate() - l.daysAgo);
    await db.ledgerEntry.create({
      data: {
        supplierId: supRecords[l.supIdx].id,
        kind: l.kind,
        amount: l.amount,
        note: l.note,
        paymentMethod: l.method,
        paymentDetail: l.detail,
        userName: "Abebe Owner",
        createdAt: date,
      },
    });
  }

  console.log(`seeded OK: ${products.length} products, ${saleNumber - 1} sales, ${STAFF.length} staff, ${customers.length} customers, ${debts.length} debts, ${suppliers.length} suppliers`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
