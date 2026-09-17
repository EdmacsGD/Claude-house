// Supabase connection details for Claude House.
//
// This key is meant to be public. It is safe in a file anyone can read
// ONLY because row level security is on for every table (see schema.sql).
// Never put a sb_secret_... or service_role key here. Those bypass RLS
// and would give anyone who opens devtools full access to your database.

export const SUPABASE_URL = 'https://ewfiupvsjxmwafpllmju.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_RFSBXanaI72rg2BH0AEbZw_uCi5sK4T';
