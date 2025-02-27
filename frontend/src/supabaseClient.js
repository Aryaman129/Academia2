import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zqzitiypvwexenxbkazf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxeml0aXlwdndleGVueGJrYXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDMwODQ1MiwiZXhwIjoyMDU1ODg0NDUyfQ.3EHSC4cxhrq-UjBotQIMvvnUILLc19F_8ROq7RfSEYk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
