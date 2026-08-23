/*
  Warnings:

  - You are about to drop the column `profileGroupId` on the `ppp_profile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ppp_profile" DROP CONSTRAINT "ppp_profile_profileGroupId_fkey";

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "profileGroupId" TEXT;

-- AlterTable
ALTER TABLE "ppp_profile" DROP COLUMN "profileGroupId";

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_profileGroupId_fkey" FOREIGN KEY ("profileGroupId") REFERENCES "profile_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
