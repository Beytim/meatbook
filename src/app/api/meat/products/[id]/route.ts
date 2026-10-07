import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, emoji, priceTakeHome, priceEatHere, active } = body;
  try {
    const product = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name) }),
        ...(emoji !== undefined && { emoji: String(emoji) }),
        ...(priceTakeHome !== undefined && { priceTakeHome: Number(priceTakeHome) }),
        ...(priceEatHere !== undefined && { priceEatHere: Number(priceEatHere) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await audit("PRODUCT_UPDATE", `Updated product ${product.name}`, undefined, { productId: product.id });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json({ error: "Could not update product" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const product = await db.product.delete({ where: { id } });
    await audit("PRODUCT_DELETE", `Deleted product ${product.name}`, undefined, { productId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Could not delete product (may be in use)" }, { status: 400 });
  }
}
