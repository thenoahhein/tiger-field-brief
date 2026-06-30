-- CreateTable
CREATE TABLE "RawNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noteDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "company" TEXT,
    "persona" TEXT,
    "workload" TEXT,
    "rawText" TEXT NOT NULL,

    CONSTRAINT "RawNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawNoteId" TEXT NOT NULL,
    "source" TEXT,
    "company" TEXT,
    "persona" TEXT,
    "workload" TEXT,
    "currentSystem" TEXT,
    "painCategory" TEXT,
    "pain" TEXT,
    "competitor" TEXT,
    "exactCustomerLanguage" TEXT,
    "productConfusion" TEXT,
    "docsGap" TEXT,
    "salesEnablementNeed" TEXT,
    "productFeedback" TEXT,
    "businessImplication" TEXT,
    "suggestedAction" TEXT,
    "confidence" INTEGER,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawNoteId" TEXT NOT NULL,
    "title" TEXT,
    "strongestMarketSignal" TEXT,
    "topSignalsJson" JSONB NOT NULL,
    "repeatedPainsJson" JSONB NOT NULL,
    "customerLanguageJson" JSONB NOT NULL,
    "competitorsJson" JSONB NOT NULL,
    "productConfusionJson" JSONB NOT NULL,
    "docsGapsJson" JSONB NOT NULL,
    "salesEnablementJson" JSONB NOT NULL,
    "productFeedbackJson" JSONB NOT NULL,
    "recommendedAction" TEXT,
    "pmmTakeaway" TEXT,
    "fullMarkdown" TEXT NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signal_rawNoteId_idx" ON "Signal"("rawNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_rawNoteId_key" ON "Brief"("rawNoteId");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_rawNoteId_fkey" FOREIGN KEY ("rawNoteId") REFERENCES "RawNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_rawNoteId_fkey" FOREIGN KEY ("rawNoteId") REFERENCES "RawNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
