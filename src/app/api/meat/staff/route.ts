import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";

export async function GET() {
  const staff = await db.staff.findMany({ orderBy: [{ role: "asc" }, { joinedAt: "asc" }] });
  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, role, pin } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const member = await db.staff.create({ data: { name: String(name), role: (role || "CASHIER").toUpperCase(), pin: pin || null } });
  await audit("STAFF_CREATE", `Added staff ${name} (${role})`, undefined, { staffId: member.id });
  return NextResponse.json({ staff: member });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, name, role, pin, active } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const member = await db.staff.update({ where: { id }, data: { ...(name !== undefined && { name }), ...(role !== undefined && { role: role.toUpperCase() }), ...(pin !== undefined && { pin }), ...(active !== undefined && { active }) } });
  await audit("STAFF_UPDATE", `Updated staff ${member.name}`, undefined, { staffId: id });
  return NextResponse.json({ staff: member });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.staff.delete({ where: { id } });
  await audit("STAFF_DELETE", `Removed staff`, undefined, { staffId: id });
  return NextResponse.json({ ok: true });
}
