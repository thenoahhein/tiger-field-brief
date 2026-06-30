-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "signalType" TEXT,
ADD COLUMN     "sourceQuality" TEXT;

-- CreateTable
CREATE TABLE "SourceSearchRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "since" TIMESTAMP(3),
    "until" TIMESTAMP(3),
    "limit" INTEGER,

    CONSTRAINT "SourceSearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchRunId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT,
    "title" TEXT,
    "url" TEXT,
    "author" TEXT,
    "channel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "metadataJson" JSONB,
    "rawNoteId" TEXT,

    CONSTRAINT "SourceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceResult_searchRunId_idx" ON "SourceResult"("searchRunId");

-- CreateIndex
CREATE INDEX "SourceResult_rawNoteId_idx" ON "SourceResult"("rawNoteId");

-- AddForeignKey
ALTER TABLE "SourceResult" ADD CONSTRAINT "SourceResult_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SourceSearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceResult" ADD CONSTRAINT "SourceResult_rawNoteId_fkey" FOREIGN KEY ("rawNoteId") REFERENCES "RawNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

