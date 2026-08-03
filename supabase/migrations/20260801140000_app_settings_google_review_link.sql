-- Google review URL for post-installation feedback messages.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_review_link text;
