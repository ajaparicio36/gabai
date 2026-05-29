-- CreateTable
CREATE TABLE "AreaRiskScores" (
    "id" TEXT NOT NULL,
    "latKey" DOUBLE PRECISION NOT NULL,
    "lngKey" DOUBLE PRECISION NOT NULL,
    "floodScore" DOUBLE PRECISION,
    "floodLevel" TEXT,
    "trafficScore" DOUBLE PRECISION,
    "trafficSpeedRatio" DOUBLE PRECISION,
    "yieldScore" DOUBLE PRECISION,
    "yieldArticleCount" INTEGER,
    "marketPremium" DOUBLE PRECISION,
    "faultScore" DOUBLE PRECISION DEFAULT 0.5,
    "metadata" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaRiskScores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlSeed" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'all',
    "maxPages" INTEGER NOT NULL DEFAULT 10,
    "requestDelayMs" INTEGER NOT NULL DEFAULT 3000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "urlsFound" INTEGER NOT NULL DEFAULT 0,
    "urlsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AreaRiskScores_latKey_lngKey_key" ON "AreaRiskScores"("latKey", "lngKey");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlSeed_url_propertyType_key" ON "CrawlSeed"("url", "propertyType");

-- CreateIndex
CREATE INDEX "CrawlJob_seedId_idx" ON "CrawlJob"("seedId");

-- CreateIndex
CREATE INDEX "CrawlJob_status_idx" ON "CrawlJob"("status");
