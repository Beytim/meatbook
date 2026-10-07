import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs/promises";

const DB_PATH = "/home/z/my-project/db/custom.db";
const QUOTA = 10 * 1024 * 1024 * 1024; // 10 GB

export async function GET() {
  let dbSize = 0;
  let dbPath = DB_PATH;
  try {
    const stat = await fs.stat(DB_PATH);
    dbSize = stat.size;
  } catch { /* ignore */ }

  const lastBackup = await db.backup.findFirst({ orderBy: { createdAt: "desc" } });
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const lastBackupTime = lastBackup ? new Date(lastBackup.createdAt).getTime() : 0;
  const backupHealth = !lastBackup ? "Critical" : lastBackupTime < sevenDaysAgo ? "Critical" : "Healthy";

  return NextResponse.json({
    dbSize,
    dbPath,
    quota: QUOTA,
    used: dbSize,
    free: QUOTA - dbSize,
    lastBackup: lastBackup ? { createdAt: lastBackup.createdAt, size: lastBackup.size } : null,
    backupHealth,
  });
}
