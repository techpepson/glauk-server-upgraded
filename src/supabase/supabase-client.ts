import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl) {
  throw new Error(
    'SUPABASE_PROJECT_URL is not set. Set it in your .env or environment.',
  );
}

if (!supabaseKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. Set it in your .env or environment.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
