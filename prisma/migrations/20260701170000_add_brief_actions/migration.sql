-- Add briefId and origin columns to ActionItem for brief-level auto-generated actions.

ALTER TABLE "ActionItem" ADD COLUMN "briefId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'report';

CREATE INDEX "ActionItem_briefId_idx" ON "ActionItem"("briefId");

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
