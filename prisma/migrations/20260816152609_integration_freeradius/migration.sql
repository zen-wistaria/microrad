-- AlterTable
ALTER TABLE "nas_router" ADD COLUMN     "apiPassword" TEXT,
ADD COLUMN     "apiPort" INTEGER NOT NULL DEFAULT 8728,
ADD COLUMN     "apiUsername" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "radiusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "radiusSecret" TEXT,
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "status" SET DEFAULT 'unknown';

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "extKey" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "radcheck" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radreply" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupcheck" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radgroupcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupreply" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radgroupreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radusergroup" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "groupname" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "radusergroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radacct" (
    "RadAcctId" BIGSERIAL NOT NULL,
    "AcctSessionId" TEXT NOT NULL,
    "AcctUniqueId" TEXT NOT NULL,
    "UserName" TEXT,
    "GroupName" TEXT,
    "Realm" TEXT,
    "NASIPAddress" INET,
    "NASPortId" TEXT,
    "NASPortType" TEXT,
    "AcctStartTime" TIMESTAMPTZ(6),
    "AcctUpdateTime" TIMESTAMPTZ(6),
    "AcctStopTime" TIMESTAMPTZ(6),
    "AcctInterval" BIGINT,
    "AcctSessionTime" BIGINT,
    "AcctAuthentic" TEXT,
    "ConnectInfo_start" TEXT,
    "ConnectInfo_stop" TEXT,
    "AcctInputOctets" BIGINT,
    "AcctOutputOctets" BIGINT,
    "CalledStationId" TEXT,
    "CallingStationId" TEXT,
    "AcctTerminateCause" TEXT,
    "ServiceType" TEXT,
    "FramedProtocol" TEXT,
    "FramedIPAddress" INET,
    "FramedIPv6Address" INET,
    "FramedIPv6Prefix" INET,
    "FramedInterfaceId" TEXT,
    "DelegatedIPv6Prefix" INET,
    "Class" TEXT,

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("RadAcctId")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "pass" TEXT,
    "reply" TEXT,
    "CalledStationId" TEXT,
    "CallingStationId" TEXT,
    "authdate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Class" TEXT,

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas" (
    "id" SERIAL NOT NULL,
    "nasname" TEXT NOT NULL,
    "shortname" TEXT,
    "type" TEXT,
    "ports" INTEGER,
    "secret" TEXT NOT NULL,
    "server" TEXT,
    "community" TEXT,
    "description" TEXT,

    CONSTRAINT "nas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radcheck_username_idx" ON "radcheck"("username");

-- CreateIndex
CREATE UNIQUE INDEX "radcheck_username_attribute_key" ON "radcheck"("username", "attribute");

-- CreateIndex
CREATE INDEX "radreply_username_idx" ON "radreply"("username");

-- CreateIndex
CREATE UNIQUE INDEX "radreply_username_attribute_key" ON "radreply"("username", "attribute");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_idx" ON "radgroupcheck"("groupname");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_idx" ON "radgroupreply"("groupname");

-- CreateIndex
CREATE INDEX "radusergroup_username_idx" ON "radusergroup"("username");

-- CreateIndex
CREATE UNIQUE INDEX "radacct_AcctUniqueId_key" ON "radacct"("AcctUniqueId");

-- CreateIndex
CREATE INDEX "radacct_start_user_idx" ON "radacct"("AcctStartTime", "UserName");

-- CreateIndex
CREATE INDEX "radpostauth_username_idx" ON "radpostauth"("username");

-- CreateIndex
CREATE INDEX "radpostauth_class_idx" ON "radpostauth"("Class");

-- CreateIndex
CREATE UNIQUE INDEX "nas_nasname_key" ON "nas"("nasname");

-- CreateIndex
CREATE INDEX "session_nasId_extKey_idx" ON "session"("nasId", "extKey");
