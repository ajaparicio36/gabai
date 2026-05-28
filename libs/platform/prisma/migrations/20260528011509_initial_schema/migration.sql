-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "tier" TEXT NOT NULL DEFAULT 'free',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "rawTitle" TEXT,
    "addressRaw" TEXT,
    "googlePlaceId" TEXT,
    "city" TEXT,
    "barangay" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "propertyType" TEXT NOT NULL,
    "listingType" TEXT NOT NULL DEFAULT 'standard',
    "lotAreaSqm" DOUBLE PRECISION,
    "floorAreaSqm" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "buildingAgeYears" INTEGER,
    "developer" TEXT,
    "askingPricePhp" DOUBLE PRECISION NOT NULL,
    "pricePerSqmPhp" DOUBLE PRECISION,
    "listingDate" TIMESTAMP(3),
    "zonalValuePhp" DOUBLE PRECISION,
    "landClassification" TEXT,
    "proximityScores" JSONB,
    "phivolcsRisk" DOUBLE PRECISION,
    "floodRisk" DOUBLE PRECISION,
    "crepTier" TEXT,
    "crepPhp" DOUBLE PRECISION,
    "userSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "inputLat" DOUBLE PRECISION,
    "inputLng" DOUBLE PRECISION,
    "inputAddress" TEXT,
    "propertyType" TEXT NOT NULL,
    "lotAreaSqm" DOUBLE PRECISION,
    "floorAreaSqm" DOUBLE PRECISION,
    "pointEstimatePhp" DOUBLE PRECISION NOT NULL,
    "confidenceLowPhp" DOUBLE PRECISION NOT NULL,
    "confidenceHighPhp" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "dataCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "comparablesUsed" JSONB NOT NULL,
    "proximityBreakdown" JSONB NOT NULL,
    "birCompliance" JSONB,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyId" TEXT,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "verificationHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaIntelligence" (
    "id" TEXT NOT NULL,
    "latKey" DOUBLE PRECISION NOT NULL,
    "lngKey" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 1500,
    "bulletPoints" TEXT[],
    "sourceArticles" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordCount" INTEGER,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingTarget" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "propertyType" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrapedAt" TIMESTAMP(3),
    "recordCount" INTEGER,
    "errorLog" TEXT,

    CONSTRAINT "ScrapingTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingTrainingRecord" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "addressRaw" TEXT,
    "city" TEXT,
    "barangay" TEXT,
    "propertyType" TEXT,
    "lotAreaSqm" DOUBLE PRECISION,
    "floorAreaSqm" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "askingPricePhp" DOUBLE PRECISION,
    "pricePerSqmPhp" DOUBLE PRECISION,
    "listingDate" TIMESTAMP(3),
    "developer" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingTrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentReference" (
    "id" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zonalValuePhp" DOUBLE PRECISION,
    "landClassification" TEXT,
    "phivolcsRisk" DOUBLE PRECISION,
    "floodRisk" DOUBLE PRECISION,
    "barangayMultiplier" DOUBLE PRECISION,
    "priceTrend6m" DOUBLE PRECISION,
    "lguAssessedValue" DOUBLE PRECISION,
    "assessmentLevel" DOUBLE PRECISION,
    "farMultiplier" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonalValue" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "streetOrSubd" TEXT,
    "zoneType" TEXT NOT NULL,
    "zonalValuePhp" DOUBLE PRECISION NOT NULL,
    "rdoSource" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZonalValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelPath" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mape" DOUBLE PRECISION,
    "trainingRecords" INTEGER,
    "jobId" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Property_lat_lng_idx" ON "Property"("lat", "lng");

-- CreateIndex
CREATE INDEX "Property_barangay_city_idx" ON "Property"("barangay", "city");

-- CreateIndex
CREATE INDEX "Property_propertyType_idx" ON "Property"("propertyType");

-- CreateIndex
CREATE INDEX "Property_googlePlaceId_idx" ON "Property"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Property_listingType_idx" ON "Property"("listingType");

-- CreateIndex
CREATE UNIQUE INDEX "Report_valuationId_key" ON "Report"("valuationId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_verificationHash_key" ON "Report"("verificationHash");

-- CreateIndex
CREATE UNIQUE INDEX "AreaIntelligence_latKey_lngKey_radiusM_key" ON "AreaIntelligence"("latKey", "lngKey", "radiusM");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingTarget_url_key" ON "ScrapingTarget"("url");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingTarget_urlHash_key" ON "ScrapingTarget"("urlHash");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentReference_barangay_city_key" ON "GovernmentReference"("barangay", "city");

-- CreateIndex
CREATE INDEX "ZonalValue_barangay_city_idx" ON "ZonalValue"("barangay", "city");

-- CreateIndex
CREATE INDEX "ZonalValue_city_idx" ON "ZonalValue"("city");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
