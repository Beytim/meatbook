import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/api-helpers";
import fs from "fs/promises";
import path from "path";

const DB_PATH = "/home/z/my-project/db/custom.db";

export async function GET() {
  const backups = await db.backup.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  let dbSize = 0;
  try {
    const stat = await fs.stat(DB_PATH);
    dbSize = stat.size;
  } catch { /* ignore */ }
  const last = backups[0] ?? null;
  return NextResponse.json({ backups, dbSize, lastBackup: last });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "SNAPSHOT";
  let size = 0;
  try {
    const stat = await fs.stat(DB_PATH);
    size = stat.size;
  } catch { /* ignore */ }
  if (action === "SNAPSHOT") {
    // create a backup record (in a real app this would copy the file)
    const backup = await db.backup.create({ data: { size, note: body.note || "Manual snapshot" } });
    await audit("BACKUP_CREATE", `Backup created (${size} bytes)`);
    return NextResponse.json({ backup });
  }
  if (action === "EXPORT") {
    // return the DB file as a downloadable .mbk
    const buf = await fs.readFile(DB_PATH).catch(() => Buffer.alloc(0));
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="meatbook-${Date.now()}.mbk"`,
      },
    });
  }
  if (action === "RESTORE") {
    // body.data is base64 of a .mbk file
    if (!body.data) return NextResponse.json({ error: "no data" }, { status: 400 });
    const buf = Buffer.from(body.data, "base64");
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, buf);
    await audit("BACKUP_RESTORE", `Restored backup (${buf.length} bytes)`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
