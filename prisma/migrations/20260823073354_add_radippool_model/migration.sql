-- CreateTable
CREATE TABLE "radippool" (
    "id" SERIAL NOT NULL,
    "pool_name" VARCHAR(30) NOT NULL,
    "framedipaddress" INET NOT NULL,
    "nasipaddress" VARCHAR(15) NOT NULL DEFAULT '',
    "calledstationid" VARCHAR(30) NOT NULL DEFAULT '',
    "callingstationid" VARCHAR(30) NOT NULL DEFAULT '',
    "expiry_time" TIMESTAMPTZ(6),
    "username" VARCHAR(64) NOT NULL DEFAULT '',
    "pool_key" VARCHAR(30) NOT NULL DEFAULT '',

    CONSTRAINT "radippool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radippool_poolname_expire_idx" ON "radippool"("pool_name", "expiry_time");

-- CreateIndex
CREATE INDEX "radippool_framedipaddress_idx" ON "radippool"("framedipaddress");

-- CreateIndex
CREATE INDEX "radippool_nasip_poolkey_idx" ON "radippool"("nasipaddress", "pool_key");
