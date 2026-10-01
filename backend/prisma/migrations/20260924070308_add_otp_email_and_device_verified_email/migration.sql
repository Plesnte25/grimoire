/*
  Warnings:

  - Added the required column `email` to the `OtpCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TrustedDevice" ADD COLUMN "verifiedEmail" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pendingDeviceId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OtpCode" ("attempts", "codeHash", "consumedAt", "createdAt", "expiresAt", "id", "pendingDeviceId") SELECT "attempts", "codeHash", "consumedAt", "createdAt", "expiresAt", "id", "pendingDeviceId" FROM "OtpCode";
DROP TABLE "OtpCode";
ALTER TABLE "new_OtpCode" RENAME TO "OtpCode";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
