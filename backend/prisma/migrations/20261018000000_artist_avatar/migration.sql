-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatarMime" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarVersion" INTEGER NOT NULL DEFAULT 0;

