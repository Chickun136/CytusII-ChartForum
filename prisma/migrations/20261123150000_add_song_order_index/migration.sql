-- AlterTable
ALTER TABLE "Song" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Song_orderIndex_idx" ON "Song"("orderIndex");
