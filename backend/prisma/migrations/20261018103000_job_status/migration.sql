ALTER TABLE "Job" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Job" ADD COLUMN "claimedAt" DATETIME;

-- Rows parked by the previous worker were pushed to year 9999.
UPDATE "Job" SET "status" = 'parked' WHERE "runAfter" >= 253370764800000;

DROP INDEX "Job_runAfter_idx";
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");
