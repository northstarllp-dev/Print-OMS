-- Migration to add health and lost_reason to enquiries

ALTER TABLE "public"."enquiries"
ADD COLUMN IF NOT EXISTS "health" text DEFAULT 'Active'::text,
ADD COLUMN IF NOT EXISTS "lost_reason" text;

-- Update existing enquiries to have 'Active' health (since the default handles future ones, we explicitly update existing rows just in case)
UPDATE "public"."enquiries"
SET "health" = 'Active'
WHERE "health" IS NULL;
