-- AlterTable
ALTER TABLE "PendingTrainingRecord"
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "locationRaw" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "rawTextReference" TEXT,
  ADD COLUMN "aiExtraction" JSONB,
  ADD COLUMN "fieldConfidence" JSONB,
  ADD COLUMN "confidenceScore" DOUBLE PRECISION,
  ADD COLUMN "locationStatus" TEXT,
  ADD COLUMN "normalizationStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "normalizationIssues" JSONB,
  ADD COLUMN "normalizedAt" TIMESTAMP(3),
  ADD COLUMN "trainingEligible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Property"
  ADD COLUMN "sourceRecordId" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "normalizationConfidenceScore" DOUBLE PRECISION,
  ADD COLUMN "normalizationIssues" JSONB;

-- AlterTable
ALTER TABLE "ModelVersion"
  ADD COLUMN "errorLog" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Property_sourceRecordId_key" ON "Property"("sourceRecordId");

-- CreateIndex
CREATE INDEX "PendingTrainingRecord_status_idx" ON "PendingTrainingRecord"("status");

-- CreateIndex
CREATE INDEX "PendingTrainingRecord_normalizationStatus_idx" ON "PendingTrainingRecord"("normalizationStatus");

-- CreateIndex
CREATE INDEX "PendingTrainingRecord_trainingEligible_idx" ON "PendingTrainingRecord"("trainingEligible");

-- CreateIndex
CREATE INDEX "PendingTrainingRecord_city_province_idx" ON "PendingTrainingRecord"("city", "province");

-- CreateIndex
CREATE INDEX "Property_province_idx" ON "Property"("province");

-- AddForeignKey
ALTER TABLE "Property"
  ADD CONSTRAINT "Property_sourceRecordId_fkey"
  FOREIGN KEY ("sourceRecordId") REFERENCES "PendingTrainingRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
