// MeatBook account & provider definitions.
// Every payment method (Cash / Mobile / Bank) can have sub-accounts (providers/banks).
// The owner wants to know exactly where every Birr sits — down to the bank branch.

export type PaymentMethod = "CASH" | "MOBILE" | "BANK";

export interface SubAccount {
  id: string;       // stable id for grouping
  name: string;     // display name
  short?: string;   // short code for compact UI
}

// Cash has no sub-accounts (it's just the drawer).
export const CASH_SUBACCOUNTS: SubAccount[] = [
  { id: "DRAWER", name: "Cash Drawer", short: "Cash" },
];

// Mobile money providers operating in Ethiopia.
export const MOBILE_PROVIDERS: SubAccount[] = [
  { id: "TELEBIRR", name: "Telebirr", short: "Telebirr" },
  { id: "MPESA", name: "M-Pesa", short: "M-Pesa" },
  { id: "CBEBIRR", name: "CBE Birr", short: "CBE Birr" },
  { id: "DASHENCASH", name: "Dashen Cash", short: "Dashen Cash" },
  { id: "AWASHWALLET", name: "Awash Wallet", short: "Awash Wallet" },
  { id: "HIBRET", name: "Hibret Cash", short: "Hibret" },
];

// Commercial banks operating in Ethiopia (the full list the owner asked for).
export const ETHIOPIAN_BANKS: SubAccount[] = [
  { id: "CBE", name: "Commercial Bank of Ethiopia", short: "CBE" },
  { id: "DASHEN", name: "Dashen Bank", short: "Dashen" },
  { id: "AWASH", name: "Awash Bank", short: "Awash" },
  { id: "ABYSSINIA", name: "Bank of Abyssinia", short: "Abyssinia" },
  { id: "WEGAGEN", name: "Wegagen Bank", short: "Wegagen" },
  { id: "UNITED", name: "United Bank", short: "United" },
  { id: "NIB", name: "Nib International Bank", short: "Nib" },
  { id: "BERHAN", name: "Berhan Bank", short: "Berhan" },
  { id: "ZEMEN", name: "Zemen Bank", short: "Zemen" },
  { id: "HIBRET", name: "Hibret Bank", short: "Hibret" },
  { id: "CBO", name: "Cooperative Bank of Oromia", short: "CBO" },
  { id: "LION", name: "Lion International Bank", short: "Lion" },
  { id: "ENAT", name: "Enat Bank", short: "Enat" },
  { id: "ABAY", name: "Abay Bank", short: "Abay" },
  { id: "ADDIS", name: "Addis International Bank", short: "Addis Int'l" },
  { id: "DEBUB", name: "Debub Global Bank", short: "Debub" },
  { id: "BUNA", name: "Buna International Bank", short: "Buna" },
  { id: "OROMIA", name: "Oromia International Bank", short: "Oromia" },
  { id: "SIDAMA", name: "Sidama National Bank", short: "Sidama" },
  { id: "TSHEY", name: "Tsehay Bank", short: "Tsehay" },
];

export function subAccountsFor(method: PaymentMethod): SubAccount[] {
  switch (method) {
    case "CASH": return CASH_SUBACCOUNTS;
    case "MOBILE": return MOBILE_PROVIDERS;
    case "BANK": return ETHIOPIAN_BANKS;
  }
}

// Resolve a stored detail string to a display name.
// Falls back to the raw string if it's a custom/unknown value.
export function subAccountName(method: PaymentMethod, detail?: string | null): string {
  if (!detail) return method === "CASH" ? "Cash Drawer" : method === "MOBILE" ? "Mobile" : "Bank";
  const subs = subAccountsFor(method);
  const found = subs.find((s) => s.id === detail || s.name === detail || s.short === detail);
  return found ? found.short || found.name : detail;
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; tone: string }[] = [
  { id: "CASH", label: "Cash", tone: "emerald" },
  { id: "MOBILE", label: "Mobile", tone: "sky" },
  { id: "BANK", label: "Bank", tone: "violet" },
];

export function methodLabel(method: string): string {
  if (method === "CASH") return "Cash";
  if (method === "MOBILE") return "Mobile";
  if (method === "BANK") return "Bank";
  return method;
}

// Full display: "Mobile · Telebirr" or "Bank · CBE" or "Cash"
export function paymentDisplay(method: string, detail?: string | null): string {
  const m = methodLabel(method);
  if (method === "CASH" || !detail) return m;
  return `${m} · ${subAccountName(method as PaymentMethod, detail)}`;
}
