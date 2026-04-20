// Supabase Client Initialization

const SUPABASE_URL = 'https://ztzxujgoxiumliuvlzpr.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0enh1amdveGl1bWxpdXZsenByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjQsImV4cCI6MjA5MDY5NjM2NH0.On6hYrGF1rMZHjp4nIFZdLYBWTRsRML8EKAZ0TLI8mQ';

window.SBClient = null;
try {
  window.SBClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch (err) {
  console.error("Supabase Init Error:", err);
}

/* Helper: get current authenticated user's ID (or null) */
async function getSupabaseUserId() {
  if (!window.SBClient) return null;
  const { data: { user } } = await window.SBClient.auth.getUser();
  return user ? user.id : null;
}

/* Helper: get current user's profile (with role) */
async function getSupabaseProfile() {
  if (!window.SBClient) return null;
  const { data: { user } } = await window.SBClient.auth.getUser();
  if (!user) return null;
  const { data } = await window.SBClient.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

console.log('[Supabase] Client initialized →', SUPABASE_URL);
