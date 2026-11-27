import { NextResponse } from "next/server";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

const schema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(1024) });
const sha256Regex = /^[0-9a-f]{64}$/;
async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (sha256Regex.test(storedHash)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return hash === storedHash;
  }
  return await argon2.verify(storedHash, password).catch(() => false);
}
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 422 });
  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  const valid = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;
  if (!user || !valid) return NextResponse.json({ error: "Username atau password tidak sesuai." }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
}
