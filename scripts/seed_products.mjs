import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const companyId = '11111111-1111-1111-1111-111111111111';

async function run() {
  // First, clean up the previously added non-signage items
  console.log('Cleaning up previous mock items...');
  const oldProductIds = ['PRD-001', 'PRD-002', 'PRD-003', 'PRD-004', 'PRD-005', 'PRD-006'];
  const oldCategories = ['Business Cards', 'Flyers & Brochures', 'Banners & Signs', 'Apparel', 'Packaging'];

  await supabase.from('products').delete().in('product_id', oldProductIds).eq('company_id', companyId);
  await supabase.from('product_categories').delete().in('name', oldCategories).eq('company_id', companyId);

  // Define new Signage categories
  const categories = [
    { name: 'Indoor Signage', company_id: companyId },
    { name: 'Outdoor Signage', company_id: companyId },
    { name: 'Digital Signage', company_id: companyId },
    { name: 'Wayfinding & Directional', company_id: companyId },
    { name: 'Trade Show Displays', company_id: companyId }
  ];

  console.log('Inserting Signage categories...');
  for (const cat of categories) {
    const { error: catError } = await supabase
      .from('product_categories')
      .insert([cat]);
    if (catError) {
      if (catError.code === '23505') {
        console.log(`Category "${cat.name}" already exists.`);
      } else {
        console.error(`Error inserting category "${cat.name}":`, catError);
      }
    } else {
      console.log(`Inserted category: "${cat.name}"`);
    }
  }

  // Define new Signage products
  const products = [
    {
      product_id: 'SIG-001',
      name: 'Acrylic Lobby Sign',
      description: '3D Laser Cut Acrylic Sign for Indoor Lobbies',
      category: 'Indoor Signage',
      pricing_type: 'sqft',
      price_per_sqft: 45.00,
      is_active: true,
      company_id: companyId
    },
    {
      product_id: 'SIG-002',
      name: 'Backlit Light Box',
      description: 'Outdoor LED Backlit Sign',
      category: 'Outdoor Signage',
      pricing_type: 'unit',
      price_per_unit: 450.00,
      is_active: true,
      company_id: companyId
    },
    {
      product_id: 'SIG-003',
      name: 'Directional Arrow Sign',
      description: 'Aluminum Wayfinding Arrow Sign',
      category: 'Wayfinding & Directional',
      pricing_type: 'unit',
      price_per_unit: 75.00,
      is_active: true,
      company_id: companyId
    },
    {
      product_id: 'SIG-004',
      name: 'Vinyl Window Decal',
      description: 'Custom Cut Vinyl Graphics for Storefront Windows',
      category: 'Indoor Signage',
      pricing_type: 'sqft',
      price_per_sqft: 8.50,
      is_active: true,
      company_id: companyId
    },
    {
      product_id: 'SIG-005',
      name: 'Retractable Banner Stand',
      description: '33" x 81" Pop-up Trade Show Banner',
      category: 'Trade Show Displays',
      pricing_type: 'unit',
      price_per_unit: 120.00,
      is_active: true,
      company_id: companyId
    },
    {
      product_id: 'SIG-006',
      name: 'LED Digital Menu Board',
      description: '43" Commercial Digital Display with Mount',
      category: 'Digital Signage',
      pricing_type: 'unit',
      price_per_unit: 750.00,
      is_active: true,
      company_id: companyId
    }
  ];

  console.log('Inserting Signage products...');
  for (const prod of products) {
    const { error: prodError } = await supabase
      .from('products')
      .insert([prod]);
    if (prodError) {
       if (prodError.code === '23505') {
         console.log(`Product "${prod.name}" already exists.`);
       } else {
         console.error(`Error inserting product "${prod.name}":`, prodError);
       }
    } else {
      console.log(`Inserted product: "${prod.name}"`);
    }
  }

  console.log('Seeding complete.');
}

run();
