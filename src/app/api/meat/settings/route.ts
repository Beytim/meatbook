import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/api-helpers";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: s });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const allowed = ["shopName", "shopPhone", "shopAddress", "receiptHeader", "receiptFooter", "currency", "licenseId", "shopId", "plan", "licenseStart", "licenseExpiry", "lockEnabled", "lockPin", "autoBackup"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  const s = await db.setting.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  return NextResponse.json({ settings: s });
}
