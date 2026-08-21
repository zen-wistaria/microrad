-- AlterTable
ALTER TABLE "portal_user" ADD COLUMN "username" TEXT;
ALTER TABLE "portal_user" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_username_key" ON "portal_user"("username");
