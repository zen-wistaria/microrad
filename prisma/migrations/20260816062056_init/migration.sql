-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "roleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "password" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "password" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "profileId" TEXT,
    "staticIp" TEXT,
    "nasId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "currentSessionId" TEXT,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandwidth_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateLimitDown" INTEGER NOT NULL,
    "rateLimitUp" INTEGER NOT NULL,
    "price" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandwidth_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas_router" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'mikrotik',
    "status" TEXT NOT NULL DEFAULT 'online',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nas_router_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerUsername" TEXT NOT NULL,
    "nasId" TEXT NOT NULL,
    "nasIpAddress" TEXT NOT NULL,
    "framedIp" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL,
    "inputBytes" BIGINT NOT NULL,
    "outputBytes" BIGINT NOT NULL,
    "terminateCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerUsername" TEXT NOT NULL,
    "customerFullName" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "profileId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "adminFee" INTEGER NOT NULL,
    "installationFee" INTEGER NOT NULL,
    "taxPercent" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "brandName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "npwp" TEXT,
    "licenseNo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_log" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_login_log" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerUsername" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_session_log" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerUsername" TEXT NOT NULL,
    "nasIpAddress" TEXT NOT NULL,
    "framedIp" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL,
    "inputBytes" BIGINT NOT NULL,
    "outputBytes" BIGINT NOT NULL,
    "terminateCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_session_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_template" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "template" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "app_session_token_key" ON "app_session"("token");

-- CreateIndex
CREATE INDEX "app_account_providerId_accountId_idx" ON "app_account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "app_verification_identifier_idx" ON "app_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_email_key" ON "portal_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_customerId_key" ON "portal_user"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_session_token_key" ON "portal_session"("token");

-- CreateIndex
CREATE INDEX "portal_account_providerId_accountId_idx" ON "portal_account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "portal_verification_identifier_idx" ON "portal_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "customer_username_key" ON "customer"("username");

-- CreateIndex
CREATE UNIQUE INDEX "nas_router_ipAddress_key" ON "nas_router"("ipAddress");

-- CreateIndex
CREATE INDEX "session_customerId_startedAt_idx" ON "session"("customerId", "startedAt");

-- CreateIndex
CREATE INDEX "session_nasId_idx" ON "session"("nasId");

-- CreateIndex
CREATE INDEX "session_stoppedAt_idx" ON "session"("stoppedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoiceNumber_key" ON "invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_periodYear_periodMonth_idx" ON "invoice"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_customerId_periodYear_periodMonth_key" ON "invoice"("customerId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "payment_record_customerId_idx" ON "payment_record"("customerId");

-- CreateIndex
CREATE INDEX "payment_record_invoiceId_idx" ON "payment_record"("invoiceId");

-- CreateIndex
CREATE INDEX "global_log_timestamp_idx" ON "global_log"("timestamp");

-- CreateIndex
CREATE INDEX "global_log_source_idx" ON "global_log"("source");

-- CreateIndex
CREATE INDEX "portal_login_log_customerId_loginAt_idx" ON "portal_login_log"("customerId", "loginAt");

-- CreateIndex
CREATE INDEX "portal_session_log_customerId_startedAt_idx" ON "portal_session_log"("customerId", "startedAt");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_account" ADD CONSTRAINT "app_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user" ADD CONSTRAINT "portal_user_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_session" ADD CONSTRAINT "portal_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_account" ADD CONSTRAINT "portal_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "bandwidth_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_nasId_fkey" FOREIGN KEY ("nasId") REFERENCES "nas_router"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_nasId_fkey" FOREIGN KEY ("nasId") REFERENCES "nas_router"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_login_log" ADD CONSTRAINT "portal_login_log_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_session_log" ADD CONSTRAINT "portal_session_log_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
