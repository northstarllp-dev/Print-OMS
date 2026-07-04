-- Remove running-feet pricing from products and normalize quotation line Qty/Measurement.

-- 1. Products: migrate any running-ft pricing, then drop the column
UPDATE products
SET pricing_type = 'per_unit'
WHERE pricing_type IN ('per_running_ft', 'Per Running Ft');

UPDATE products
SET price_per_unit = COALESCE(price_per_unit, price_per_running_ft)
WHERE price_per_running_ft IS NOT NULL
  AND (price_per_unit IS NULL OR price_per_unit = 0);

ALTER TABLE products DROP COLUMN IF EXISTS price_per_running_ft;

-- 2. Quotations: normalize signage_options lines
--    - per_running_ft → per_unit
--    - Qty/Measurement lives in quantity (and totalSqFt is kept in sync)
DO $$
DECLARE
  rec RECORD;
  section jsonb;
  line jsonb;
  new_sections jsonb;
  new_lines jsonb;
  qty numeric;
  sqft numeric;
  measurement numeric;
  pricing_type text;
BEGIN
  FOR rec IN SELECT id, signage_options FROM quotations WHERE signage_options IS NOT NULL LOOP
    new_sections := '[]'::jsonb;

    FOR section IN SELECT * FROM jsonb_array_elements(COALESCE(rec.signage_options, '[]'::jsonb)) LOOP
      new_lines := '[]'::jsonb;

      FOR line IN SELECT * FROM jsonb_array_elements(COALESCE(section->'lines', '[]'::jsonb)) LOOP
        qty := COALESCE(NULLIF(line->>'quantity', '')::numeric, 0);
        sqft := COALESCE(NULLIF(line->>'totalSqFt', '')::numeric, 0);

        -- Same rule as app: legacy per_sqft/rft stored measurement in totalSqFt with quantity=1
        IF sqft > 0 AND qty = 1 AND sqft <> 1 THEN
          measurement := sqft;
        ELSIF qty > 0 THEN
          measurement := qty;
        ELSE
          measurement := sqft;
        END IF;

        IF measurement <= 0 THEN
          measurement := 1;
        END IF;

        pricing_type := COALESCE(line->>'pricingType', 'per_unit');
        IF pricing_type = 'per_running_ft' THEN
          pricing_type := 'per_unit';
        END IF;
        IF pricing_type <> 'per_sqft' THEN
          pricing_type := 'per_unit';
        END IF;

        line := line
          || jsonb_build_object(
            'pricingType', pricing_type,
            'quantity', measurement,
            'totalSqFt', measurement,
            'unit', CASE WHEN pricing_type = 'per_sqft' THEN 'sqft' ELSE 'nos' END
          );

        new_lines := new_lines || jsonb_build_array(line);
      END LOOP;

      section := section || jsonb_build_object('lines', new_lines);
      new_sections := new_sections || jsonb_build_array(section);
    END LOOP;

    UPDATE quotations SET signage_options = new_sections WHERE id = rec.id;
  END LOOP;
END $$;
