-- CreateTable
CREATE TABLE "ChartRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chartId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChartRating_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "Chart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChartRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChartRating_chartId_idx" ON "ChartRating"("chartId");

-- CreateIndex
CREATE INDEX "ChartRating_userId_idx" ON "ChartRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartRating_chartId_userId_key" ON "ChartRating"("chartId", "userId");
