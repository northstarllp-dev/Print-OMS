-- Simplify tasks: drop progress, attachments, and history.

DROP TABLE IF EXISTS public.task_attachments CASCADE;
DROP TABLE IF EXISTS public.task_history CASCADE;

ALTER TABLE public.tasks DROP COLUMN IF EXISTS progress;
