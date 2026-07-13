const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

// You must use your SERVICE ROLE KEY here, NOT the anon key, because creating users requires admin privileges.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''; 
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const newUsers = [
  { email: 'sachin@theboardcompany.in', role: 'Admin', passwordOrPhone: '9964653838' },
  { email: 'pavan@theboardcompany.in', role: 'Admin', passwordOrPhone: '9731033433' },
  { email: 'harsha@theboardcompany.in', role: 'Admin', passwordOrPhone: '7483549027' },
  { email: 'design@theboardcompany.in', role: 'Designer', passwordOrPhone: '8341313869' },
  { email: 'likith.s@theboardcompany.in', role: 'Production & Service', passwordOrPhone: '9743108886' },
  { email: 'basavaraj.s@theboardcompany.in', role: 'Recce & Installation', passwordOrPhone: '9535848661' },
  { email: 'admin@printec.in', role: 'Admin', passwordOrPhone: '9000000001' },
  { email: 'staff@printec.in', role: 'Staff', passwordOrPhone: '9000000002' },
  { email: 'designer@printec.in', role: 'Designer', passwordOrPhone: '9000000003' },
  { email: 'production@printec.in', role: 'Production', passwordOrPhone: '9000000004' },
  { email: 'installation@printec.in', role: 'Installation', passwordOrPhone: '9000000005' },
];

async function createNewUsers() {
  console.log("Starting bulk user creation...");

  for (const user of newUsers) {
    console.log(`Creating user: ${user.email}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.passwordOrPhone, // Using the 10-digit number as their initial password
      email_confirm: true, // Auto-confirm their email so they can log in immediately
      user_metadata: {
        role: user.role,
        phone: user.passwordOrPhone
      }
    });

    if (error) {
      console.error(`❌ Error creating ${user.email}:`, error.message);
    } else {
      console.log(`✅ Success! Created ${user.email} (ID: ${data.user.id})`);
    }
  }

  console.log("Done!");
}

createNewUsers();
