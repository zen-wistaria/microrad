/*
  Warnings:

  - You are about to drop the column `profileGroupId` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `nasId` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the column `profileGroupId` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the `profile_group` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `ppp_profile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "customer" DROP CONSTRAINT "customer_profileGroupId_fkey";

-- DropForeignKey
ALTER TABLE "ppp_profile" DROP CONSTRAINT "ppp_profile_nasId_fkey";

-- DropForeignKey
ALTER TABLE "ppp_profile" DROP CONSTRAINT "ppp_profile_profileGroupId_fkey";

-- AlterTable
ALTER TABLE "customer" DROP COLUMN "profileGroupId",
ADD COLUMN     "areaGroupId" TEXT;

-- AlterTable
ALTER TABLE "ppp_profile" DROP COLUMN "nasId",
DROP COLUMN "profileGroupId",
DROP COLUMN "type",
ADD COLUMN     "addMacCookie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "areaGroupId" TEXT,
ADD COLUMN     "idleTimeout" INTEGER,
ADD COLUMN     "insertQueueBefore" TEXT,
ADD COLUMN     "keepaliveTimeout" TEXT,
ADD COLUMN     "macCookieTimeout" TEXT,
ADD COLUMN     "serviceType" TEXT NOT NULL DEFAULT 'PPP',
ADD COLUMN     "sessionTimeout" INTEGER,
ALTER COLUMN "localAddress" DROP NOT NULL,
ALTER COLUMN "rangeIpEnd" DROP NOT NULL,
ALTER COLUMN "rangeIpStart" DROP NOT NULL;

-- DropTable
DROP TABLE "profile_group";

-- CreateTable
CREATE TABLE "area_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'PPP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AreaGroupToNasRouter" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AreaGroupToNasRouter_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AreaGroupToNasRouter_B_index" ON "_AreaGroupToNasRouter"("B");

-- CreateIndex
CREATE UNIQUE INDEX "ppp_profile_name_key" ON "ppp_profile"("name");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_areaGroupId_fkey" FOREIGN KEY ("areaGroupId") REFERENCES "area_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppp_profile" ADD CONSTRAINT "ppp_profile_areaGroupId_fkey" FOREIGN KEY ("areaGroupId") REFERENCES "area_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaGroupToNasRouter" ADD CONSTRAINT "_AreaGroupToNasRouter_A_fkey" FOREIGN KEY ("A") REFERENCES "area_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaGroupToNasRouter" ADD CONSTRAINT "_AreaGroupToNasRouter_B_fkey" FOREIGN KEY ("B") REFERENCES "nas_router"("id") ON DELETE CASCADE ON UPDATE CASCADE;
