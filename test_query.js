import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jekitmbnwwprbthqtaof.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-key'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testQuery() {
  const { data, error } = await supabase
    .from('users')
    .select('email, companies!inner(slug)')
    .limit(1)

  console.log('Data:', JSON.stringify(data, null, 2))
  console.log('Error:', error)
}

testQuery()
