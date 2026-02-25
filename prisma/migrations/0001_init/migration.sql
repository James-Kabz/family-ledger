-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ref" TEXT,
    "contributedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerUpdate" (
    "id" TEXT NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "generatedMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_ref_key" ON "Contribution"("ref");

-- CreateIndex
CREATE INDEX "Contribution_contributedAt_idx" ON "Contribution"("contributedAt" DESC);

-- CreateIndex
CREATE INDEX "LedgerUpdate_cutoffAt_idx" ON "LedgerUpdate"("cutoffAt" DESC);

