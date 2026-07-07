export interface QuotationProduct {
  id: string;
  product_id: string;
  name: string;
  category: string | null;
  pricing_type: string;
  is_active: boolean;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  images?: string[];
}
