-- AlterTable
ALTER TABLE "Song" ADD COLUMN "pinyinFull" TEXT;
ALTER TABLE "Song" ADD COLUMN "pinyinInitials" TEXT;

-- CreateIndex
CREATE INDEX "Song_pinyinFull_idx" ON "Song"("pinyinFull");

-- CreateIndex
CREATE INDEX "Song_pinyinInitials_idx" ON "Song"("pinyinInitials");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_songId_alias_key" ON "Alias"("songId", "alias");
