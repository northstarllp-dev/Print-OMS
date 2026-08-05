export interface QuotationProduct {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  pricing_type: string;
  is_active: boolean;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  unit_price_max_sqft?: number | null;
  pricing_type_below?: string | null;
  pricing_type_above?: string | null;
  images?: string[];
}
