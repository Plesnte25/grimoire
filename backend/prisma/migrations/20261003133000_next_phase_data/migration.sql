CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "untilAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Reminder_mediaId_key" ON "Reminder"("mediaId");

CREATE TABLE "AnnualGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "target" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AnnualGoal_year_scope_key" ON "AnnualGoal"("year", "scope");

CREATE TABLE "CustomListShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomListShare_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CustomList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomListShare_listId_key" ON "CustomListShare"("listId");
CREATE UNIQUE INDEX "CustomListShare_tokenHash_key" ON "CustomListShare"("tokenHash");

ALTER TABLE "WatchLog" ADD COLUMN "clientMutationId" TEXT;
CREATE UNIQUE INDEX "WatchLog_clientMutationId_key" ON "WatchLog"("clientMutationId");
