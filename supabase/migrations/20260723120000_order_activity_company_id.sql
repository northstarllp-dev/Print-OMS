-- Tenant-scope order_activity: friendly order_id collides across companies.
ALTER TABLE public.order_activity
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 1) Non-colliding friendly order_ids
UPDATE public.order_activity oa
SET company_id = o.company_id
FROM (
  SELECT order_id, (array_agg(company_id))[1] AS company_id
  FROM public.orders
  GROUP BY order_id
  HAVING COUNT(*) = 1
) o
WHERE oa.order_id = o.order_id
  AND oa.company_id IS NULL;

-- 2) Colliding: segment by order_created markers matched to company customer names
WITH created_markers AS (
  SELECT
    oa.id AS activity_id,
    oa.order_id,
    oa.created_at,
    o.company_id
  FROM public.order_activity oa
  JOIN public.orders o ON o.order_id = oa.order_id
  WHERE (oa.metadata->>'action') = 'order_created'
    AND (
      (NULLIF(BTRIM(o.business_name), '') IS NOT NULL AND oa.content ILIKE '%' || o.business_name || '%')
      OR (NULLIF(BTRIM(o.client_name), '') IS NOT NULL AND oa.content ILIKE '%' || o.client_name || '%')
    )
),
attributed AS (
  SELECT
    oa.id,
    (
      SELECT cm.company_id
      FROM created_markers cm
      WHERE cm.order_id = oa.order_id
        AND cm.created_at <= oa.created_at
      ORDER BY cm.created_at DESC, cm.activity_id DESC
      LIMIT 1
    ) AS company_id
  FROM public.order_activity oa
  WHERE oa.company_id IS NULL
    AND oa.order_id IN (
      SELECT order_id FROM public.orders GROUP BY order_id HAVING COUNT(*) > 1
    )
)
UPDATE public.order_activity oa
SET company_id = a.company_id
FROM attributed a
WHERE oa.id = a.id
  AND a.company_id IS NOT NULL;

-- 3) Content match to client/business name
UPDATE public.order_activity oa
SET company_id = o.company_id
FROM public.orders o
WHERE oa.company_id IS NULL
  AND oa.order_id = o.order_id
  AND (
    (NULLIF(BTRIM(o.business_name), '') IS NOT NULL AND oa.content ILIKE '%' || o.business_name || '%')
    OR (NULLIF(BTRIM(o.client_name), '') IS NOT NULL AND oa.content ILIKE '%' || o.client_name || '%')
  );

-- 4) Match payment metadata
UPDATE public.order_activity oa
SET company_id = o.company_id
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
WHERE oa.company_id IS NULL
  AND (oa.metadata->>'payment_id') = p.id::text;

-- 5) Match design item metadata
UPDATE public.order_activity oa
SET company_id = o.company_id
FROM public.orders o
JOIN public.designs d ON d.order_id = o.id
WHERE oa.company_id IS NULL
  AND oa.order_id = o.order_id
  AND NULLIF(oa.metadata->>'itemId', '') IS NOT NULL
  AND d.items::text ILIKE '%' || (oa.metadata->>'itemId') || '%';

-- 6) Rows that stored order UUID in order_id instead of friendly code
UPDATE public.order_activity oa
SET company_id = o.company_id
FROM public.orders o
WHERE oa.company_id IS NULL
  AND (oa.order_id = o.order_id OR oa.order_id = o.id::text);

CREATE INDEX IF NOT EXISTS idx_order_activity_company_order
  ON public.order_activity (company_id, order_id, created_at DESC);

DROP POLICY IF EXISTS "Company-scoped access for authenticated users" ON public.order_activity;

CREATE POLICY "Company-scoped access for authenticated users"
ON public.order_activity
TO authenticated
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());
