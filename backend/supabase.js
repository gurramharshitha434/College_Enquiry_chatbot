const { loadEnv } = require("./loadEnv");
const { createClient } = require("@supabase/supabase-js");

// Ensure environment variables are loaded
loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.warn("⚠️ Supabase credentials are missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.");
}

const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

module.exports = { supabase };
