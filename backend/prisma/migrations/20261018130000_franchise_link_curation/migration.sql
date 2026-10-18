-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FranchiseLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "order" INTEGER,
    "narrativeOrder" INTEGER,
    "isEssential" BOOLEAN NOT NULL DEFAULT true,
    "prerequisiteId" TEXT,
    "curated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FranchiseLink_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FranchiseLink_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FranchiseLink_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "FranchiseLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FranchiseLink" ("franchiseId", "id", "order", "relation", "workId") SELECT "franchiseId", "id", "order", "relation", "workId" FROM "FranchiseLink";
DROP TABLE "FranchiseLink";
ALTER TABLE "new_FranchiseLink" RENAME TO "FranchiseLink";
CREATE INDEX "FranchiseLink_franchiseId_narrativeOrder_idx" ON "FranchiseLink"("franchiseId", "narrativeOrder");
CREATE INDEX "FranchiseLink_prerequisiteId_idx" ON "FranchiseLink"("prerequisiteId");
CREATE UNIQUE INDEX "FranchiseLink_workId_franchiseId_key" ON "FranchiseLink"("workId", "franchiseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

