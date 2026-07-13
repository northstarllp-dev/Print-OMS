const { Client } = require('pg');

require('dotenv').config({ path: '.env.local' });

const PROD_DB_URL = process.env.PROD_DB_URL || '';
const DEV_DB_URL = process.env.DEV_DB_URL || '';

async function transferData() {
  const prodClient = new Client({ connectionString: PROD_DB_URL });
  const devClient = new Client({ connectionString: DEV_DB_URL });

  try {
    console.log("Connecting to databases...");
    await prodClient.connect();
    await devClient.connect();

    // 1. Transfer auth.users
    console.log("Fetching auth.users from Prod...");
    const { rows: users } = await prodClient.query('SELECT * FROM auth.users');
    console.log(`Found ${users.length} users. Inserting into Dev...`);

    for (const user of users) {
      // Remove generated columns that cannot be inserted
      delete user.confirmed_at;
      delete user.is_anonymous;

      // Build the insert query dynamically based on columns
      const cols = Object.keys(user);
      const vals = Object.values(user);

      const colString = cols.map(c => `"${c}"`).join(', ');
      const valString = vals.map((_, i) => `$${i + 1}`).join(', ');

      await devClient.query(`
        INSERT INTO auth.users (${colString}) 
        VALUES (${valString})
        ON CONFLICT (id) DO NOTHING
      `, vals);
    }
    console.log("✅ auth.users transferred!");

  } catch (err) {
    console.error("Error transferring data:", err);
  } finally {
    await prodClient.end();
    await devClient.end();
  }
}

transferData();
