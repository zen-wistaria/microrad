-- CreateIndex
CREATE INDEX "radacct_stop_user_idx" ON "radacct"("acctstoptime", "username");

-- CreateIndex
CREATE INDEX "radacct_nas_stop_idx" ON "radacct"("nasipaddress", "acctstoptime");

-- CreateIndex
CREATE INDEX "radacct_stop_update_idx" ON "radacct"("acctstoptime", "acctupdatetime");
