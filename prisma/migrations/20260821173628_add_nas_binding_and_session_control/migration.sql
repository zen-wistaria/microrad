-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "allowedNasIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxSimultaneous" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sessionMode" TEXT NOT NULL DEFAULT 'single';

-- CreateTable
CREATE TABLE "radnasallow" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "nasipaddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radnasallow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radnasallow_username_idx" ON "radnasallow"("username");

-- CreateIndex
CREATE UNIQUE INDEX "radnasallow_username_nasipaddress_key" ON "radnasallow"("username", "nasipaddress");
