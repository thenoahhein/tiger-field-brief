-- Add scheduled GTM intelligence watchlists, reports, and action queue.

CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER NOT NULL DEFAULT 10,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntelligenceReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "summary" TEXT NOT NULL,
    "learnedJson" JSONB NOT NULL,
    "repeatedPainsJson" JSONB NOT NULL,
    "competitorsJson" JSONB NOT NULL,
    "productConfusionJson" JSONB NOT NULL,
    "recommendedActionsJson" JSONB NOT NULL,
    "salesNotesJson" JSONB NOT NULL,
    "productNotesJson" JSONB NOT NULL,
    "sourceRunIdsJson" JSONB,
    "fullMarkdown" TEXT NOT NULL,

    CONSTRAINT "IntelligenceReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT,
    "title" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT,
    "owner" TEXT,
    "useFor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "evidenceJson" JSONB,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SourceSearchRun" ADD COLUMN "watchlistId" TEXT;

CREATE INDEX "Watchlist_enabled_nextRunAt_idx" ON "Watchlist"("enabled", "nextRunAt");
CREATE INDEX "Watchlist_category_idx" ON "Watchlist"("category");
CREATE INDEX "SourceSearchRun_watchlistId_idx" ON "SourceSearchRun"("watchlistId");
CREATE INDEX "IntelligenceReport_reportType_createdAt_idx" ON "IntelligenceReport"("reportType", "createdAt");
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");
CREATE INDEX "ActionItem_reportId_idx" ON "ActionItem"("reportId");

ALTER TABLE "SourceSearchRun" ADD CONSTRAINT "SourceSearchRun_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IntelligenceReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
