/*
  Warnings:

  - You are about to drop the column `bandwidthId` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `ppp_profile` table. All the data in the column will be lost.
  - You are about to drop the column `dnsServers` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `ipModule` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `localAddress` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `nasId` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `parentQueue` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `rangeIpEnd` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `rangeIpStart` on the `profile_group` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `profile_group` table. All the data in the column will be lost.
  - Added the required column `localAddress` to the `ppp_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nasId` to the `ppp_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rangeIpEnd` to the `ppp_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rangeIpStart` to the `ppp_profile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "customer" DROP CONSTRAINT "customer_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ppp_profile" DROP CONSTRAINT "ppp_profile_bandwidthId_fkey";

-- DropForeignKey
ALTER TABLE "profile_group" DROP CONSTRAINT "profile_group_nasId_fkey";

-- AlterTable
ALTER TABLE "ppp_profile" DROP COLUMN "bandwidthId",
DROP COLUMN "price",
DROP COLUMN "priority",
ADD COLUMN     "dnsServers" TEXT NOT NULL DEFAULT '8.8.8.8,8.8.4.4',
ADD COLUMN     "ipModule" TEXT NOT NULL DEFAULT 'sql',
ADD COLUMN     "localAddress" TEXT NOT NULL,
ADD COLUMN     "nasId" TEXT NOT NULL,
ADD COLUMN     "parentQueue" TEXT,
ADD COLUMN     "profileGroupId" TEXT,
ADD COLUMN     "rangeIpEnd" TEXT NOT NULL,
ADD COLUMN     "rangeIpStart" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PPP';

-- AlterTable
ALTER TABLE "profile_group" DROP COLUMN "dnsServers",
DROP COLUMN "ipModule",
DROP COLUMN "localAddress",
DROP COLUMN "nasId",
DROP COLUMN "parentQueue",
DROP COLUMN "rangeIpEnd",
DROP COLUMN "rangeIpStart",
DROP COLUMN "type",
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "internet_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "bandwidthId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internet_profile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "internet_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppp_profile" ADD CONSTRAINT "ppp_profile_nasId_fkey" FOREIGN KEY ("nasId") REFERENCES "nas_router"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppp_profile" ADD CONSTRAINT "ppp_profile_profileGroupId_fkey" FOREIGN KEY ("profileGroupId") REFERENCES "profile_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internet_profile" ADD CONSTRAINT "internet_profile_bandwidthId_fkey" FOREIGN KEY ("bandwidthId") REFERENCES "bandwidth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
