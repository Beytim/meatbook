import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const waste = await db.wastage.delete({ where: { id } });
    await audit("WASTAGE_DELETE", `Deleted waste entry ${waste.name} · ${waste.kg} kg`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete waste entry" }, { status: 400 });
  }
}
