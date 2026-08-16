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
    "radacctid" BIGSERIAL NOT NULL,
    "acctsessionid" TEXT NOT NULL,
    "acctuniqueid" TEXT NOT NULL,
    "username" TEXT,
    "groupname" TEXT,
    "realm" TEXT,
    "nasipaddress" INET,
    "nasportid" TEXT,
    "nasporttype" TEXT,
    "acctstarttime" TIMESTAMPTZ(6),
    "acctupdatetime" TIMESTAMPTZ(6),
    "acctstoptime" TIMESTAMPTZ(6),
    "acctinterval" BIGINT,
    "acctsessiontime" BIGINT,
    "acctauthentic" TEXT,
    "connectinfo_start" TEXT,
    "connectinfo_stop" TEXT,
    "acctinputoctets" BIGINT,
    "acctoutputoctets" BIGINT,
    "calledstationid" TEXT,
    "callingstationid" TEXT,
    "acctterminatecause" TEXT,
    "servicetype" TEXT,
    "framedprotocol" TEXT,
    "framedipaddress" INET,
    "framedipv6address" INET,
    "framedipv6prefix" INET,
    "framedinterfaceid" TEXT,
    "delegatedipv6prefix" INET,
    "class" TEXT,

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radacctid")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "pass" TEXT,
    "reply" TEXT,
    "calledstationid" TEXT,
    "callingstationid" TEXT,
    "authdate" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "class" TEXT,

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
CREATE UNIQUE INDEX "radacct_acctuniqueid_key" ON "radacct"("acctuniqueid");

-- CreateIndex
CREATE INDEX "radacct_start_user_idx" ON "radacct"("acctstarttime", "username");

-- CreateIndex
CREATE INDEX "radpostauth_username_idx" ON "radpostauth"("username");

-- CreateIndex
CREATE INDEX "radpostauth_class_idx" ON "radpostauth"("class");

-- CreateIndex
CREATE UNIQUE INDEX "nas_nasname_key" ON "nas"("nasname");

-- CreateIndex