const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: { transport: WebSocket },
});

const promptContent = fs.readFileSync(
  path.resolve(__dirname, '..', 'prompt-amine-structure.txt'),
  'utf-8'
).trim();

async function main() {
  console.log('Prompt length:', promptContent.length);
  console.log('Has {{CATALOG}}:', promptContent.includes('{{CATALOG}}'));

  const { data, error } = await supabase
    .from('app_config')
    .update({ system_prompt: promptContent })
    .eq('id', true)
    .select()
    .single();

  if (error) {
    console.error('Error updating system_prompt:', error.message);
    process.exit(1);
  }

  console.log('system_prompt updated successfully');
  console.log('DB system_prompt length:', data.system_prompt.length);
  console.log('DB has {{CATALOG}}:', data.system_prompt.includes('{{CATALOG}}'));
}

main().catch((err) => { console.error(err); process.exit(1); });
