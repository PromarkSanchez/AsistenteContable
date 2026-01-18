-- AlterTable: Change dias_anticipacion from INT to INT[]
-- First convert existing values to arrays

ALTER TABLE "alert_configs"
  ALTER COLUMN "dias_anticipacion" TYPE INTEGER[]
  USING ARRAY["dias_anticipacion"]::INTEGER[];

-- Set default value for new records
ALTER TABLE "alert_configs"
  ALTER COLUMN "dias_anticipacion" SET DEFAULT ARRAY[3]::INTEGER[];
