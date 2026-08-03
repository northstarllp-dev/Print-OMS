const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearOrders() {
  const companyId = '55555555-5555-5555-5555-555555555555';
  
  console.log(`Getting orders for company_id: ${companyId}...`);
  const { data: orders, error: getError } = await supabase
    .from('orders')
    .select('id')
    .eq('company_id', companyId);

  if (getError) {
    console.error("Error getting orders:", getError);
    return;
  }
  
  const orderIds = orders.map(o => o.id);
  console.log(`Found ${orderIds.length} orders.`);

  if (orderIds.length > 0) {
    console.log("Nullifying order_id in enquiries to avoid FK constraint...");
    const { error: enqError } = await supabase
      .from('enquiries')
      .update({ order_id: null })
      .in('order_id', orderIds);
      
    if (enqError) {
       console.error("Error updating enquiries:", enqError);
       return;
    }
    
    console.log("Also nullifying or deleting designs, activity logs if they reference these orders...");
    
    // Some common tables that reference order_id
    await supabase.from('designs').delete().in('order_id', orderIds);
    await supabase.from('order_activity').delete().in('order_id', orderIds);
    // There may be other tables like `order_items` etc. 
    // It's safer to just delete the orders and see if any other FKs pop up.
  }

  console.log(`Attempting to delete orders...`);
  
  const { error, count } = await supabase
    .from('orders')
    .delete({ count: 'exact' })
    .eq('company_id', companyId);

  if (error) {
    console.error("Error deleting orders:", error);
  } else {
    console.log(`Successfully deleted ${count || 0} orders for company ${companyId}.`);
  }
}

clearOrders();
