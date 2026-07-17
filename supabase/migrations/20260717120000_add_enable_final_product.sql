-- Add enable_final_product column to app_settings table
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS enable_final_product boolean NOT NULL DEFAULT false;
