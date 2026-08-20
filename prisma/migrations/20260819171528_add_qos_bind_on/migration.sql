-- AlterTable
ALTER TABLE "bandwidth_profile" ADD COLUMN     "burstLimitDown" INTEGER,
ADD COLUMN     "burstLimitUp" INTEGER,
ADD COLUMN     "burstThresholdDown" INTEGER,
ADD COLUMN     "burstThresholdUp" INTEGER,
ADD COLUMN     "burstTimeSeconds" INTEGER,
ADD COLUMN     "limitAtDown" INTEGER,
ADD COLUMN     "limitAtUp" INTEGER,
ADD COLUMN     "priority" INTEGER;

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "bindOnNas" BOOLEAN NOT NULL DEFAULT false;
