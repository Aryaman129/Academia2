import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zqzitiypvwexenxbkazf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxeml0aXlwdndleGVueGJrYXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMDg0NTIsImV4cCI6MjA1NTg4NDQ1Mn0.Vi_83ZUnK6NebdS1EX1xmH19rthwPAr5FMsqgnIQB30";
export const supabase = createClient(supabaseUrl, supabaseKey);