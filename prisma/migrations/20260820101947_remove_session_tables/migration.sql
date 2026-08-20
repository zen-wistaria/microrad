/*
  Warnings:

  - You are about to drop the column `currentSessionId` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_customerId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_nasId_fkey";

-- AlterTable
ALTER TABLE "customer" DROP COLUMN "currentSessionId";

-- DropTable
DROP TABLE "session";
