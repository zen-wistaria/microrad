import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/** Simulasi RADIUS ping (sama seperti versi mock) */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.read");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan");
  if (router.status === "offline") {
    return NextResponse.json({ data: { status: "offline", latencyMs: 0 } });
  }
  return NextResponse.json({
    data: { status: "online", latencyMs: Math.floor(Math.random() * 15) + 2 },
  });
});
