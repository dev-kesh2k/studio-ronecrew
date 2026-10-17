-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "phoneKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Reference" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_phoneKey_idx" ON "Booking"("phoneKey");


-- Preenche a chave do celular dos agendamentos existentes (só dígitos, sem o 55).
UPDATE "Booking" b SET "phoneKey" = CASE WHEN length(s.d) IN (12, 13) AND s.d LIKE '55%' THEN substr(s.d, 3) ELSE s.d END
FROM (SELECT id, regexp_replace("clientPhone", '\D', '', 'g') AS d FROM "Booking") s
WHERE s.id = b.id;
