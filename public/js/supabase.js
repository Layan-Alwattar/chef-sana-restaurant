// Supabase client for Chef Sana's Restaurant.
// The URL + anon key are safe to expose in the browser — access is controlled
// by Row Level Security policies on the database, not by hiding this key.
//
// Loaded after the Supabase UMD bundle (window.supabase), before auth.js/app.js.

const SUPABASE_URL = "https://wktrdrdhvgnojojvghci.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHJkcmRodmdub2pvanZnaGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODQwNjAsImV4cCI6MjA5Njg2MDA2MH0.aA7w5oTaOw8Xka69OvloE4lOjLf9DDpez6hhjND5sQ0";

// `window.supabase` is the library global from the CDN bundle.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
