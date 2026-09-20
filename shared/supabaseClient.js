// Shared Supabase client config. The anon key is meant to be public — it only
// grants what Row Level Security policies in the database allow.
const SUPABASE_URL = "https://orddbbrlxdnynbwhcqrm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGRiYnJseGRueW5id2hjcXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDA2NzEsImV4cCI6MjEwNTM3NjY3MX0.6Y6q2dAuXXNmH4Vp5nlIZlsU7IkCOKzx-4Gtvj19-qU";

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
