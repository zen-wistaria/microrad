import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { syncSingleRouter } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/** Sinkronisasi manual sesi PPPoE dari satu router (tanpa menunggu tick). */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.update");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");
  if (!router.apiUsername) {
    throw new Error("Kredensial API RouterOS belum diisi pada router ini.");
  }
  const summary = await syncSingleRouter(router);
  return NextResponse.json({ data: summary });
});
