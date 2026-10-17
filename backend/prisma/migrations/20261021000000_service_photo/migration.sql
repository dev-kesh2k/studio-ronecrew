-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "photo" BYTEA,
ADD COLUMN     "photoMime" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "photoVersion" INTEGER NOT NULL DEFAULT 0;
