import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/api-helpers";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const s = await getSettings();
  const now = new Date();
  const expiry = new Date(s.licenseExpiry);
  const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000));
  return NextResponse.json({
    license: {
      licenseId: s.licenseId,
      shopId: s.shopId,
      plan: s.plan,
      status: daysRemaining > 0 ? "Active" : "Expired",
      daysRemaining,
      start: s.licenseStart,
      expiry: s.licenseExpiry,
    },
  });
}

// Renew by pasting a signed key. For this demo, we accept a base64url payload
// containing {shopId, expiry} and just apply the expiry.
export async function POST(req: Request) {
  const body = await req.json();
  const key = body.key as string;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  try {
    const payloadB64 = key.split(".")[0];
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(json);
    const s = await getSettings();
    if (payload.shopId && payload.shopId !== s.shopId) {
      return NextResponse.json({ error: "Key is for a different shop ID" }, { status: 400 });
    }
    const expiry = new Date(payload.expiry);
    if (isNaN(expiry.getTime())) return NextResponse.json({ error: "Invalid expiry in key" }, { status: 400 });
    const updated = await db.setting.update({ where: { id: "singleton" }, data: { licenseExpiry: expiry, licenseId: payload.licenseId || s.licenseId } });
    await audit("LICENSE_RENEW", `License renewed to ${expiry.toISOString()}`);
    return NextResponse.json({ ok: true, licenseExpiry: updated.licenseExpiry });
  } catch {
    return NextResponse.json({ error: "Invalid license key" }, { status: 400 });
  }
}
