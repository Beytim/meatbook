// MeatBook i18n — English + Amharic
// Add more keys as needed. Keep keys stable.

export type Lang = "en" | "am";

export const LANGS: { id: Lang; name: string; native: string }[] = [
  { id: "en", name: "English", native: "English" },
  { id: "am", name: "Amharic", native: "አማርኛ" },
];

type Dict = Record<string, { en: string; am: string }>;

export const dict: Dict = {
  // Nav
  "nav.home": { en: "Home", am: "መነሻ" },
  "nav.sell": { en: "Sell", am: "ሽያጭ" },
  "nav.products": { en: "Products", am: "ምርቶች" },
  "nav.money": { en: "Money", am: "ገንዘብ" },
  "nav.more": { en: "More", am: "ተጨማሪ" },

  // Home
  "home.todaysSales": { en: "Today's Sales", am: "የዛሬ ሽያጭ" },
  "home.takeHome": { en: "Take Home", am: "ወደ ቤት" },
  "home.eatHere": { en: "Eat Here", am: "እዚህ ይበሉ" },
  "home.purchaseRecovery": { en: "Purchase Recovery", am: "የግዢ መልስ" },
  "home.netResult": { en: "Net Result", am: "የመጨረሻ ውጤት" },
  "home.soldToday": { en: "Sold Today", am: "ዛሬ የተሸጠ" },
  "home.boughtToday": { en: "Bought Today", am: "ዛሬ የተገዛ" },
  "home.moneyFromSales": { en: "Today's sales — by media", am: "የዛሬ ሽያጭ — በመንገድ" },
  "home.startSelling": { en: "Start Selling", am: "ሽያጭ ይጀምሩ" },
  "home.noSales": { en: "No sales yet today", am: "ዛሬ እስካሁን ሽያጭ የለም" },
  "home.moneyLost": { en: "MONEY LOST", am: "ገንዘብ ጠፍቷል" },
  "home.moneyMade": { en: "MONEY MADE", am: "ገንዘብ ተገኝቷል" },
  "home.breakEven": { en: "BREAK EVEN", am: "እኩል ነው" },
  "home.belowPurchaseCost": { en: "below purchase cost", am: "ከግዢ ወጪ በታች" },
  "home.abovePurchaseCost": { en: "above purchase cost", am: "ከግዢ ወጪ በላይ" },
  "home.costRecovered": { en: "Purchase cost recovered", am: "የግዢ ወጪ ተመልሷል" },
  "home.sales": { en: "sales", am: "ሽያጭ" },
  "home.purchase": { en: "purchase", am: "ግዢ" },
  "home.expenses": { en: "expenses", am: "ወጪዎች" },
  "home.sold": { en: "sold", am: "ተሸጧል" },
  "home.left": { en: "left", am: "ቀር" },

  // Quick actions
  "qa.sell": { en: "Sell", am: "ሽያጭ" },
  "qa.expense": { en: "Expense", am: "ወጪ" },
  "qa.purchase": { en: "Purchase", am: "ግዢ" },
  "qa.waste": { en: "Waste", am: "እቃ መጣስ" },

  // More sheet groups
  "more.salesRecords": { en: "Sales & Records", am: "ሽያጭ እና መዝገብ" },
  "more.moneyStock": { en: "Money & Stock", am: "ገንዘብ እና እቃ" },
  "more.insights": { en: "Insights", am: "ግምገማ" },
  "more.system": { en: "System", am: "ስርዓት" },

  // Common
  "common.back": { en: "Back", am: "ተመለስ" },
  "common.save": { en: "Save", am: "አስቀምጥ" },
  "common.cancel": { en: "Cancel", am: "ሰርዝ" },
  "common.record": { en: "Record", am: "መዝግብ" },
  "common.add": { en: "Add", am: "ጨምር" },
  "common.total": { en: "Total", am: "ድምር" },
  "common.search": { en: "Search", am: "ፈልግ" },
  "common.loading": { en: "Loading…", am: "በመጫን ላይ…" },
  "common.offline": { en: "Offline", am: "ከመስመር ውጭ" },

  // Brand
  "brand.tagline": { en: "Digital Butcher's Book", am: "ዲጂታል የስጋ መዝገብ" },
};

export function t(key: string, lang: Lang = "en"): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}
