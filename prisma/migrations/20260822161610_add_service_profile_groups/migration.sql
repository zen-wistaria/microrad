/*
  Warnings:

  - You are about to drop the `bandwidth_profile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "customer" DROP CONSTRAINT "customer_profileId_fkey";

-- DropTable
DROP TABLE "bandwidth_profile";

-- CreateTable
CREATE TABLE "bandwidth" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minUpload" INTEGER,
    "minUploadUnit" TEXT NOT NULL DEFAULT 'Kbps',
    "minDownload" INTEGER,
    "minDownloadUnit" TEXT NOT NULL DEFAULT 'Kbps',
    "maxUpload" INTEGER NOT NULL,
    "maxUploadUnit" TEXT NOT NULL DEFAULT 'Mbps',
    "maxDownload" INTEGER NOT NULL,
    "maxDownloadUnit" TEXT NOT NULL DEFAULT 'Mbps',
    "burstLimitUpload" INTEGER,
    "burstLimitUploadUnit" TEXT DEFAULT 'Mbps',
    "burstLimitDownload" INTEGER,
    "burstLimitDownloadUnit" TEXT DEFAULT 'Mbps',
    "burstThresholdUpload" INTEGER,
    "burstThresholdUploadUnit" TEXT DEFAULT 'Mbps',
    "burstThresholdDownload" INTEGER,
    "burstThresholdDownloadUnit" TEXT DEFAULT 'Mbps',
    "burstTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandwidth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nasId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PPP',
    "ipModule" TEXT NOT NULL DEFAULT 'sql',
    "localAddress" TEXT NOT NULL,
    "rangeIpStart" TEXT NOT NULL,
    "rangeIpEnd" TEXT NOT NULL,
    "dnsServers" TEXT NOT NULL DEFAULT '8.8.8.8,8.8.4.4',
    "parentQueue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppp_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "profileGroupId" TEXT NOT NULL,
    "bandwidthId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppp_profile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ppp_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_group" ADD CONSTRAINT "profile_group_nasId_fkey" FOREIGN KEY ("nasId") REFERENCES "nas_router"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppp_profile" ADD CONSTRAINT "ppp_profile_profileGroupId_fkey" FOREIGN KEY ("profileGroupId") REFERENCES "profile_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppp_profile" ADD CONSTRAINT "ppp_profile_bandwidthId_fkey" FOREIGN KEY ("bandwidthId") REFERENCES "bandwidth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
