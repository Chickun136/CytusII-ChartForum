-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "character" TEXT,
    "category" TEXT,
    "bpm" INTEGER,
    "coverUrl" TEXT,
    "metadataSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Chart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "difficultyIndex" INTEGER NOT NULL,
    "difficultyName" TEXT NOT NULL,
    "difficultyLevel" TEXT,
    "jsonFile" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "noteCount" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chart_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "songId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alias_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Song_title_idx" ON "Song"("title");

-- CreateIndex
CREATE INDEX "Song_artist_idx" ON "Song"("artist");

-- CreateIndex
CREATE INDEX "Chart_songId_idx" ON "Chart"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "Chart_songId_difficultyIndex_key" ON "Chart"("songId", "difficultyIndex");

-- CreateIndex
CREATE INDEX "Alias_alias_idx" ON "Alias"("alias");

-- CreateIndex
CREATE INDEX "Alias_songId_idx" ON "Alias"("songId");
